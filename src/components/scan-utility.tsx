import { useNavigate } from '@tanstack/react-router'
import { Camera, Plus, ScanLine, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type DetectorConstructor = {
  new (options?: { formats?: string[] }): { detect: (image: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> }
}

type ResolvePayload = {
  barcode: { id: string | null; barcodeValue: string; format: string } | null
  association: {
    lineId: string | null
    lineName: string | null
    manufacturerName: string | null
    colorwayId: string | null
    colorwayName: string | null
  } | null
  isAssociated: boolean
  isKnownBarcode: boolean
}

type SearchPayload = {
  lines: Array<{
    id: string
    name: string
    manufacturerName: string
    colorways: Array<{ id: string; name: string; colorCode: string | null }>
  }>
}

export function ScanUtility({ showFab = true }: { showFab?: boolean }) {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<number | null>(null)
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null)
  const scanTipTimerRef = useRef<number | null>(null)

  const [open, setOpen] = useState(!showFab)
  const [cameraActive, setCameraActive] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [status, setStatus] = useState('Open scanner to detect a barcode.')
  const [scanHint, setScanHint] = useState('Looking for barcode...')
  const [resolveData, setResolveData] = useState<ResolvePayload | null>(null)
  const [showAssociationEditor, setShowAssociationEditor] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchData, setSearchData] = useState<SearchPayload | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedAssociation, setSelectedAssociation] = useState<{ lineId: string; colorwayId: string | null } | null>(null)
  const [newColorwayName, setNewColorwayName] = useState('')
  const [newColorwayCode, setNewColorwayCode] = useState('')
  const [inventoryQuantity, setInventoryQuantity] = useState(1)

  const associationOptions = useMemo(() => {
    const options: Array<{
      key: string
      lineId: string
      colorwayId: string | null
      label: string
      meta: string
    }> = []

    for (const line of searchData?.lines ?? []) {
      options.push({
        key: `${line.id}:line`,
        lineId: line.id,
        colorwayId: null,
        label: `${line.manufacturerName} · ${line.name}`,
        meta: 'Line-level association',
      })

      for (const color of line.colorways) {
        options.push({
          key: `${line.id}:${color.id}`,
          lineId: line.id,
          colorwayId: color.id,
          label: `${line.manufacturerName} · ${line.name} · ${color.name}`,
          meta: color.colorCode ? `Color code: ${color.colorCode}` : 'Colorway-level association',
        })
      }
    }

    return options
  }, [searchData])

  useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }
    void startCamera()
    return stopCamera
  }, [open])

  useEffect(() => {
    return () => stopCamera()
  }, [])

  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!barcode || resolveData?.isAssociated) {
      return
    }

    if (trimmed.length < 2) {
      setSearchData(null)
      setSearchLoading(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      void searchCatalog(trimmed)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [searchQuery, barcode, resolveData?.isAssociated])

  const stopCamera = () => {
    zxingControlsRef.current?.stop()
    zxingControlsRef.current = null

    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    setCameraActive(false)

    if (scanTipTimerRef.current) {
      window.clearInterval(scanTipTimerRef.current)
      scanTipTimerRef.current = null
    }
  }

  const startScanTips = () => {
    const tips = [
      'Looking for barcode...',
      'Tip: move camera slightly farther away.',
      'Tip: reduce glare on glossy labels.',
      'Tip: keep barcode horizontal and centered.',
      'Tip: improve lighting for better contrast.',
    ]

    let index = 0
    setScanHint(tips[index])
    if (scanTipTimerRef.current) {
      window.clearInterval(scanTipTimerRef.current)
    }

    scanTipTimerRef.current = window.setInterval(() => {
      index = (index + 1) % tips.length
      setScanHint(tips[index])
    }, 3200)
  }

  const resetForNewScan = async () => {
    setBarcode('')
    setResolveData(null)
    setSearchQuery('')
    setSearchData(null)
    setSelectedAssociation(null)
    setNewColorwayName('')
    setNewColorwayCode('')
    setInventoryQuantity(1)
    setShowAssociationEditor(false)
    setStatus('Open scanner to detect a barcode.')
    await startCamera()
  }

  const startCamera = async () => {
    stopCamera()

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera access is not available in this browser.')
      return
    }

    try {
      const zxingReady = await startZxingScanner()
      if (zxingReady) {
        return
      }

      const Detector = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
      if (!Detector) {
        setStatus('No camera barcode engine available. You can still enter barcode manually.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })

      if (!videoRef.current) {
        return
      }

      videoRef.current.setAttribute('playsinline', 'true')
      videoRef.current.muted = true

      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraActive(true)
      setStatus('Scanning with native detector... hold barcode in frame.')
      startScanTips()

      const detector = new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
      })

      const tick = async () => {
        if (!videoRef.current) {
          return
        }
        try {
          const found = await detector.detect(videoRef.current)
          if (found[0]?.rawValue) {
            const resolved = found[0].rawValue
            setBarcode(resolved)
            stopCamera()
            await resolveBarcode(resolved)
            return
          }
        } catch {
          setStatus('Scanner active. Waiting for barcode...')
        }

        frameRef.current = window.requestAnimationFrame(tick)
      }

      frameRef.current = window.requestAnimationFrame(tick)
    } catch {
      setStatus('Unable to start camera scanner. You can enter barcode manually.')
      stopCamera()
    }
  }

  const startZxingScanner = async () => {
    if (!videoRef.current) {
      return false
    }

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      videoRef.current.setAttribute('playsinline', 'true')
      videoRef.current.muted = true

      setStatus('Scanning with ZXing... point camera at barcode.')

      const onDecode = async (
        result: unknown,
        error: unknown,
        activeControls: { stop: () => void },
      ) => {
        if (result) {
          const rawValue =
            typeof (result as { getText?: () => string }).getText === 'function'
              ? (result as { getText: () => string }).getText()
              : ''

          if (rawValue) {
            setBarcode(rawValue)
            activeControls.stop()
            zxingControlsRef.current = null
            setCameraActive(false)
            await resolveBarcode(rawValue)
            return
          }
        }

        if (error && (error as { name?: string }).name !== 'NotFoundException') {
          setStatus('Scanner is active, but had trouble decoding. Adjust camera distance and lighting.')
        }
      }

      let controls: { stop: () => void }
      try {
        controls = (await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          onDecode,
        )) as { stop: () => void }
      } catch {
        controls = (await reader.decodeFromVideoDevice(undefined, videoRef.current, onDecode)) as {
          stop: () => void
        }
      }

      zxingControlsRef.current = controls as { stop: () => void }
      setCameraActive(true)
      startScanTips()
      return true
    } catch {
      return false
    }
  }

  const resolveBarcode = async (value = barcode) => {
    const cleaned = value.trim()
    if (!cleaned) {
      setStatus('Enter or scan a barcode first.')
      return
    }

    const response = await fetch(`/api/scan/resolve?barcode=${encodeURIComponent(cleaned)}`)
    const payload = (await response.json()) as ResolvePayload & { message?: string }

    if (!response.ok) {
      setResolveData(null)
      setStatus(payload.message ?? 'Could not resolve barcode.')
      return
    }

    setResolveData(payload)
    if (payload.isAssociated) {
      setStatus('Barcode matched existing association.')
      setShowAssociationEditor(false)
    } else {
      setStatus(`No association found for ${payload.barcode?.barcodeValue ?? cleaned}. Search, associate, or create item.`)
      setShowAssociationEditor(true)
    }
  }

  const addResolvedToInventory = async () => {
    if (!resolveData?.association?.lineId) {
      return
    }
    const response = await fetch('/api/scan/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineId: resolveData.association.lineId,
        colorwayId: resolveData.association.colorwayId,
        quantity: inventoryQuantity,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Added to inventory.' : 'Could not add to inventory.'))
  }

  const reportMismatch = async () => {
    if (!resolveData?.barcode?.id) {
      return
    }
    const response = await fetch('/api/community/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'barcode_association',
        entityId: resolveData.barcode.id,
        reason: 'wrong_association',
        details: `Scanner mismatch reported for barcode ${resolveData.barcode.barcodeValue}`,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Mismatch flagged.' : 'Could not submit mismatch.'))
    setShowAssociationEditor(true)
    const suggestion = `${resolveData?.association?.manufacturerName ?? ''} ${resolveData?.association?.lineName ?? ''}`.trim()
    setSearchQuery(suggestion)
    if (suggestion) {
      await searchCatalog(suggestion)
    }
  }

  const searchCatalog = async (query: string) => {
    if (!query.trim()) {
      return
    }

    setSearchLoading(true)
    const response = await fetch(`/api/scan/search?query=${encodeURIComponent(query.trim())}`)
    const payload = (await response.json()) as SearchPayload
    setSearchData(payload)
    setSearchLoading(false)
    if (!payload.lines.length) {
      setStatus('No matching yarn lines found.')
    }
  }

  const associateAndAdd = async () => {
    if (!barcode || !selectedAssociation?.lineId) {
      setStatus('Scan barcode and select a line/colorway first.')
      return
    }

    const associateResponse = await fetch('/api/scan/associate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodeValue: barcode,
        lineId: selectedAssociation.lineId,
        colorwayId: newColorwayName.trim() ? null : selectedAssociation.colorwayId,
        newColorwayName: newColorwayName.trim() || null,
        newColorCode: newColorwayCode.trim() || null,
      }),
    })

    const associatePayload = (await associateResponse.json()) as { message?: string }
    if (!associateResponse.ok) {
      setStatus(associatePayload.message ?? 'Could not associate barcode.')
      return
    }

    const inventoryResponse = await fetch('/api/scan/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineId: selectedAssociation.lineId,
        colorwayId: newColorwayName.trim() ? null : selectedAssociation.colorwayId,
        quantity: inventoryQuantity,
      }),
    })

    const inventoryPayload = (await inventoryResponse.json()) as { message?: string }
    setStatus(inventoryPayload.message ?? 'Associated and added to inventory.')
    setNewColorwayName('')
    setNewColorwayCode('')
    setShowAssociationEditor(false)
    await resolveBarcode(barcode)
  }

  const associateOnly = async () => {
    if (!barcode || !selectedAssociation?.lineId) {
      setStatus('Scan barcode and select a line/colorway first.')
      return
    }

    const associateResponse = await fetch('/api/scan/associate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodeValue: barcode,
        lineId: selectedAssociation.lineId,
        colorwayId: newColorwayName.trim() ? null : selectedAssociation.colorwayId,
        newColorwayName: newColorwayName.trim() || null,
        newColorCode: newColorwayCode.trim() || null,
      }),
    })

    const payload = (await associateResponse.json()) as { message?: string }
    setStatus(payload.message ?? (associateResponse.ok ? 'Barcode associated.' : 'Could not associate barcode.'))

    if (associateResponse.ok) {
      setNewColorwayName('')
      setNewColorwayCode('')
      setInventoryQuantity(1)
      setShowAssociationEditor(false)
      await resolveBarcode(barcode)
    }
  }

  const openCreatePage = async () => {
    if (!barcode) {
      setStatus('Scan barcode first.')
      return
    }

    if (showFab) {
      setOpen(false)
    }

    await navigate({
      to: '/scan/create-item',
      search: {
        barcode,
        q: searchQuery.trim(),
      },
    })
  }

  const panel = (
    <div className="scan-utility-panel" suppressHydrationWarning>
      <div className="scan-utility-head">
        <h3>Quick Scan</h3>
        {showFab ? (
          <button aria-label="Close scan utility" className="icon-button" onClick={() => setOpen(false)} type="button">
            <X size={14} />
          </button>
        ) : null}
      </div>

      <p>{cameraActive ? scanHint : status}</p>

      <video autoPlay className={`scanner-video ${cameraActive ? 'active' : ''}`} muted playsInline ref={videoRef} />

      <div className="hero-actions">
        <button className="button button-primary" onClick={() => void startCamera()} type="button">
          <Camera size={14} /> Start camera
        </button>
        <button className="button" onClick={() => void resetForNewScan()} type="button">
          New scan
        </button>
        <button className="button" onClick={stopCamera} type="button">
          Stop
        </button>
      </div>

      <div className="inline-form">
        <label>
          Barcode
          <input onChange={(event) => setBarcode(event.target.value)} type="text" value={barcode} />
        </label>
        <button className="button" onClick={() => void resolveBarcode()} type="button">
          Resolve
        </button>
      </div>

      {resolveData?.isAssociated && resolveData.association?.lineId ? (
        <div className="scan-section">
          <strong>
            Matched: {resolveData.association.manufacturerName} · {resolveData.association.lineName}
            {resolveData.association.colorwayName ? ` · ${resolveData.association.colorwayName}` : ''}
          </strong>
          <label>
            Quantity
            <input
              min={1}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setInventoryQuantity(Math.max(1, Number(event.target.value) || 1))}
              type="number"
              value={inventoryQuantity}
            />
          </label>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => void addResolvedToInventory()} type="button">
              Add to inventory
            </button>
            <button className="button" onClick={() => void reportMismatch()} type="button">
              Report mismatch
            </button>
            <button
              className="button subtle-button"
              onClick={() => {
                const suggestion = `${resolveData.association?.manufacturerName ?? ''} ${resolveData.association?.lineName ?? ''}`.trim()
                setSearchQuery(suggestion)
                setSelectedAssociation({ lineId: resolveData.association?.lineId ?? '', colorwayId: resolveData.association?.colorwayId ?? null })
                setShowAssociationEditor(true)
                if (suggestion) {
                  void searchCatalog(suggestion)
                }
              }}
              type="button"
            >
              Correct association
            </button>
          </div>
        </div>
      ) : null}

      {((!resolveData?.isAssociated && barcode) || (resolveData?.isAssociated && showAssociationEditor)) ? (
        <div className="scan-section">
          <h4>Associate to existing item</h4>
          <input
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setSelectedAssociation(null)
            }}
            placeholder="Start typing line or manufacturer"
            type="text"
            value={searchQuery}
          />

          {associationOptions.length ? (
            <div className="scan-results-list">
              {associationOptions.map((option) => (
                <button
                  className={`scan-result-item ${selectedAssociation?.lineId === option.lineId && selectedAssociation?.colorwayId === option.colorwayId ? 'selected' : ''}`}
                  key={option.key}
                  onClick={() => {
                    setSelectedAssociation({
                      lineId: option.lineId,
                      colorwayId: option.colorwayId,
                    })
                    setNewColorwayName('')
                    setNewColorwayCode('')
                  }}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <span>{option.meta}</span>
                </button>
              ))}
            </div>
          ) : null}

          {searchLoading ? <p>Searching...</p> : null}

          {selectedAssociation?.lineId ? (
            <div className="stack-form">
              <label>
                Quantity
                <input
                  min={1}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setInventoryQuantity(Math.max(1, Number(event.target.value) || 1))}
                  type="number"
                  value={inventoryQuantity}
                />
              </label>
              <label>
                Add missing colorway (optional)
                <input
                  onChange={(event) => setNewColorwayName(event.target.value)}
                  placeholder="ex: Cotton Candy"
                  type="text"
                  value={newColorwayName}
                />
              </label>
              {newColorwayName.trim() ? (
                <label>
                  Color code (optional)
                  <input
                    onChange={(event) => setNewColorwayCode(event.target.value)}
                    placeholder="ex: 2126-36"
                    type="text"
                    value={newColorwayCode}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {!searchLoading && searchQuery.trim().length >= 2 && searchData && searchData.lines.length === 0 ? (
            <button className="button" onClick={() => void openCreatePage()} type="button">
              <Plus size={14} /> No matches. Create new item
            </button>
          ) : null}

          <button className="button button-primary" onClick={() => void associateAndAdd()} type="button">
            Associate + add to inventory
          </button>
          <button className="button subtle-button" onClick={() => void associateOnly()} type="button">
            Associate only
          </button>
        </div>
      ) : null}
    </div>
  )

  if (!showFab) {
    return panel
  }

  return (
    <>
      <button aria-label="Open quick barcode scanner" className="scan-fab" onClick={() => setOpen(true)} type="button">
        <ScanLine size={18} />
      </button>
      {open ? <div className="scan-utility-modal">{panel}</div> : null}
    </>
  )
}
