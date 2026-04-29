import { createFileRoute } from '@tanstack/react-router'
import { BookOpenCheck, Download, Ellipsis, ImagePlus, Lock, Minus, Package, Plus, Save, Scissors, Search, Shapes, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { FileDropInput } from '#/components/file-drop-input'

export const Route = createFileRoute('/inventory')({
  validateSearch: (search: Record<string, unknown>): { tab?: InventoryKind } => {
    const tab = typeof search.tab === 'string' ? search.tab : ''
    if (tab === 'yarn' || tab === 'hooks' || tab === 'patterns' || tab === 'creations') {
      return { tab }
    }
    return {}
  },
  component: InventoryPage,
})

type InventoryKind = 'yarn' | 'hooks' | 'patterns' | 'creations'

type YarnItem = {
  id: string
  yarnLineId: string | null
  yarnColorwayId: string | null
  nickname: string | null
  quantity: number
  isLowStock: boolean
  isProjectReserved: boolean
  storageLocation: string | null
  notes: string | null
  updatedAt: number
  lineName: string | null
  manufacturerName: string | null
  colorwayName: string | null
  colorCode: string | null
}

type HookItem = {
  id: string
  sizeLabel: string
  metricSizeMm: string | null
  material: string | null
  quantity: number
}

type PatternItem = {
  id: string
  title: string
  description: string | null
  sourceUrl: string | null
  difficulty: string | null
  isPublic: boolean
  publicShareConfirmed: boolean
  hasPdf: boolean
  hasCover: boolean
  pdfFileName: string | null
  moderationStatus: string
  moderationReason: string | null
  notes: string | null
  updatedAt: number
}

type CreationItem = {
  id: string
  name: string
  status: string
  isPublic: boolean
  moderationStatus: string
  moderationReason: string | null
  notes: string | null
  patternId: string | null
  patternTitle: string | null
  yarnCount: number
  hookCount: number
  imageCount: number
}

type SearchPayload = {
  lines: Array<{
    id: string
    name: string
    manufacturerName: string
    colorways: Array<{ id: string; name: string; colorCode: string | null }>
  }>
}

type InventoryResponse = {
  kind: InventoryKind
  summary: Record<string, number>
  items: Array<YarnItem | HookItem | PatternItem | CreationItem>
}

type PublicPatternsResponse = {
  patterns: Array<{
    id: string
    title: string
    description: string | null
    difficulty: string | null
    sourceUrl: string | null
    hasPdf: boolean
    hasCover: boolean
    ownerDisplayName: string
    updatedAt: number
  }>
}

const tabs: Array<{ key: InventoryKind; label: string; icon: typeof Package }> = [
  { key: 'yarn', label: 'Yarn', icon: Package },
  { key: 'hooks', label: 'Hooks', icon: Shapes },
  { key: 'patterns', label: 'Patterns', icon: BookOpenCheck },
  { key: 'creations', label: 'Creations', icon: Scissors },
]

function InventoryPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const activeTab = useMemo<InventoryKind>(() => {
    if (search.tab === 'hooks' || search.tab === 'patterns' || search.tab === 'creations') {
      return search.tab
    }
    return 'yarn'
  }, [search.tab])
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [data, setData] = useState<InventoryResponse | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Record<string, string | number | boolean | null>>>({})

  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogResults, setCatalogResults] = useState<SearchPayload['lines']>([])
  const [selectedLineId, setSelectedLineId] = useState('')
  const [selectedColorwayId, setSelectedColorwayId] = useState('')
  const [newYarnQuantity, setNewYarnQuantity] = useState(1)
  const [newYarnLocation, setNewYarnLocation] = useState('')
  const [newYarnNickname, setNewYarnNickname] = useState('')
  const [newYarnNotes, setNewYarnNotes] = useState('')
  const [newYarnLowStock, setNewYarnLowStock] = useState(false)
  const [newYarnReserved, setNewYarnReserved] = useState(false)

  const [newHook, setNewHook] = useState({ sizeLabel: '', metricSizeMm: '', material: '', quantity: 1 })
  const [newPattern, setNewPattern] = useState({
    title: '',
    description: '',
    sourceUrl: '',
    difficulty: '',
    notes: '',
    isPublic: false,
    publicShareConfirmed: false,
  })
  const [newPatternPdfFile, setNewPatternPdfFile] = useState<File | null>(null)
  const [newPatternCoverFile, setNewPatternCoverFile] = useState<File | null>(null)
  const [publicPatterns, setPublicPatterns] = useState<PublicPatternsResponse['patterns']>([])
  const [newCreation, setNewCreation] = useState({ name: '', status: 'active', patternId: '', notes: '', isPublic: false })
  const [newCreationImages, setNewCreationImages] = useState<File[]>([])
  const [creationYarnOptions, setCreationYarnOptions] = useState<Array<{ id: string; label: string }>>([])
  const [creationHookOptions, setCreationHookOptions] = useState<Array<{ id: string; label: string }>>([])
  const [newCreationYarnIds, setNewCreationYarnIds] = useState<string[]>([])
  const [newCreationHookIds, setNewCreationHookIds] = useState<string[]>([])
  const [patternChoices, setPatternChoices] = useState<Array<{ id: string; title: string }>>([])
  const [addingItem, setAddingItem] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [patternUploadProgress, setPatternUploadProgress] = useState<{
    open: boolean
    total: number
    completed: number
    currentLabel: string
    error: string | null
  }>({
    open: false,
    total: 0,
    completed: 0,
    currentLabel: '',
    error: null,
  })
  const [patternMenuOpenId, setPatternMenuOpenId] = useState<string | null>(null)
  const [editingPatternId, setEditingPatternId] = useState<string | null>(null)

  const selectedLine = useMemo(
    () => catalogResults.find((line) => line.id === selectedLineId) ?? null,
    [catalogResults, selectedLineId],
  )

  const loadInventory = async (kind = activeTab, searchValue = query) => {
    setLoading(true)
    setError(null)
    const response = await fetch(`/api/scan/inventory?kind=${kind}&query=${encodeURIComponent(searchValue.trim())}`)
    const payload = (await response.json()) as InventoryResponse & { message?: string }

    if (!response.ok) {
      setError(payload.message ?? 'Could not load inventory data.')
      setData(null)
      setLoading(false)
      return
    }

    setData(payload)
    setDrafts(
      Object.fromEntries(
        payload.items.map((item) => {
          if (payload.kind === 'yarn') {
            const yarn = item as YarnItem
            return [
              yarn.id,
              {
                quantity: yarn.quantity,
                storageLocation: yarn.storageLocation ?? '',
                nickname: yarn.nickname ?? '',
                notes: yarn.notes ?? '',
                isLowStock: yarn.isLowStock,
                isProjectReserved: yarn.isProjectReserved,
              },
            ]
          }
          if (payload.kind === 'hooks') {
            const hook = item as HookItem
            return [hook.id, { sizeLabel: hook.sizeLabel, metricSizeMm: hook.metricSizeMm ?? '', material: hook.material ?? '', quantity: hook.quantity }]
          }
          if (payload.kind === 'patterns') {
            const pattern = item as PatternItem
            return [
              pattern.id,
              {
                title: pattern.title,
                description: pattern.description ?? '',
                sourceUrl: pattern.sourceUrl ?? '',
                difficulty: pattern.difficulty ?? '',
                isPublic: pattern.isPublic,
                publicShareConfirmed: pattern.publicShareConfirmed,
                notes: pattern.notes ?? '',
              },
            ]
          }
          const creation = item as CreationItem
          return [
            creation.id,
            {
              name: creation.name,
              status: creation.status,
              patternId: creation.patternId ?? '',
              isPublic: creation.isPublic,
              notes: creation.notes ?? '',
            },
          ]
        }),
      ),
    )
    setLoading(false)
  }

  useEffect(() => {
    void loadInventory(activeTab, query)
  }, [activeTab, query])

  useEffect(() => {
    if (activeTab !== 'creations') {
      return
    }
    Promise.all([
      fetch('/api/scan/inventory?kind=patterns').then((response) => response.json() as Promise<InventoryResponse>),
      fetch('/api/scan/inventory?kind=yarn').then((response) => response.json() as Promise<InventoryResponse>),
      fetch('/api/scan/inventory?kind=hooks').then((response) => response.json() as Promise<InventoryResponse>),
    ])
      .then(([patternsPayload, yarnPayload, hooksPayload]) => {
        setPatternChoices(
          patternsPayload.items.map((item) => {
            const pattern = item as PatternItem
            return { id: pattern.id, title: pattern.title }
          }),
        )
        setCreationYarnOptions(
          (yarnPayload.items as YarnItem[]).map((item) => ({
            id: item.id,
            label: `${item.manufacturerName ?? 'Unknown'} · ${item.lineName ?? 'Unknown'}${item.colorwayName ? ` · ${item.colorwayName}` : ''}`,
          })),
        )
        setCreationHookOptions(
          (hooksPayload.items as HookItem[]).map((item) => ({
            id: item.id,
            label: `${item.sizeLabel}${item.metricSizeMm ? ` (${item.metricSizeMm}mm)` : ''}${item.material ? ` · ${item.material}` : ''}`,
          })),
        )
      })
      .catch(() => {
        setPatternChoices([])
        setCreationYarnOptions([])
        setCreationHookOptions([])
      })
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'patterns') {
      return
    }
    fetch('/api/patterns/public')
      .then((response) => response.json() as Promise<PublicPatternsResponse>)
      .then((payload) => setPublicPatterns(payload.patterns ?? []))
      .catch(() => setPublicPatterns([]))
  }, [activeTab])

  const searchCatalog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleaned = catalogQuery.trim()
    if (cleaned.length < 2) {
      setStatus('Type at least 2 characters to search catalog lines.')
      return
    }

    setCatalogLoading(true)
    const response = await fetch(`/api/scan/search?query=${encodeURIComponent(cleaned)}`)
    const payload = (await response.json()) as SearchPayload
    setCatalogResults(payload.lines)
    setSelectedLineId(payload.lines[0]?.id ?? '')
    setSelectedColorwayId('')
    setCatalogLoading(false)
  }

  const patchItem = async (itemId: string, values: Record<string, string | number | boolean | null>) => {
    const response = await fetch('/api/scan/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: activeTab, itemId, ...values }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Saved.' : 'Could not save.'))
    return response.ok
  }

  const uploadPatternAsset = async (patternId: string, kind: 'pdf' | 'cover', file: File) => {
    try {
    const presignResponse = await fetch(`/api/patterns/${patternId}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        fileName: file.name,
        mimeType: file.type,
        byteSize: file.size,
      }),
    })
    const presignPayload = await parseJsonOrText(presignResponse)
    if (!presignResponse.ok || !presignPayload.uploadUrl || !presignPayload.key || !presignPayload.contentType) {
      const message = presignPayload.message ?? `Could not prepare ${kind} upload.`
      setStatus(message)
      return { ok: false, message }
    }

    const uploadResponse = await fetch(presignPayload.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': presignPayload.contentType },
      body: file,
    })
    if (!uploadResponse.ok) {
      const message = `Upload to storage failed for ${kind}. HTTP ${uploadResponse.status} ${uploadResponse.statusText || ''}`.trim()
      setStatus(message)
      return { ok: false, message }
    }

    const attachResponse = await fetch(`/api/patterns/${patternId}/attach-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        key: presignPayload.key,
        fileName: file.name,
      }),
    })
    const attachPayload = await parseJsonOrText(attachResponse)
    if (!attachResponse.ok) {
      const message = attachPayload.message ?? `Could not attach uploaded ${kind}.`
      setStatus(message)
      return { ok: false, message }
    }

    return { ok: true, message: `${kind} uploaded.` }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : `Unexpected ${kind} upload error.`
      const message = /Failed to fetch/i.test(rawMessage)
        ? `Upload network/CORS error for ${kind}. Check R2 bucket CORS for PUT from this app origin.`
        : rawMessage
      setStatus(message)
      return { ok: false, message }
    }
  }

  const parseJsonOrText = async (response: Response): Promise<{ message?: string; [key: string]: any }> => {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      return (await response.json()) as { message?: string; [key: string]: any }
    }
    const text = await response.text()
    return { message: text || undefined }
  }

  const uploadCreationImages = async (creationId: string, files: File[]) => {
    if (!files.length) {
      return true
    }
    const form = new FormData()
    files.forEach((file) => form.append('files', file))
    const response = await fetch(`/api/creations/${creationId}/images`, {
      method: 'POST',
      body: form,
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not upload creation images.')
      return false
    }
    return true
  }

  const adjustYarnQuantity = async (itemId: string, delta: number) => {
    if (!data || data.kind !== 'yarn') {
      return
    }

    const currentItems = data.items as YarnItem[]
    const target = currentItems.find((item) => item.id === itemId)
    if (!target) {
      return
    }

    const nextQuantity = Math.max(1, target.quantity + delta)
    const previous = currentItems
    const updated = previous.map((item) => (item.id === itemId ? { ...item, quantity: nextQuantity } : item))
    setData({ ...data, items: updated })

    const ok = await patchItem(itemId, { quantity: nextQuantity })
    if (!ok) {
      setData({ ...data, items: previous })
    }
  }

  const addCurrentItem = async () => {
    if (addingItem) {
      return
    }
    setAddingItem(true)
    setStatus('Saving item...')
    try {
    if (activeTab === 'yarn') {
      if (!selectedLineId) {
        setStatus('Select a yarn line first.')
        return
      }
      await fetch('/api/scan/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'yarn',
          lineId: selectedLineId,
          colorwayId: selectedColorwayId || null,
          quantity: newYarnQuantity,
          storageLocation: newYarnLocation,
          nickname: newYarnNickname,
          notes: newYarnNotes,
          isLowStock: newYarnLowStock,
          isProjectReserved: newYarnReserved,
        }),
      })
      setNewYarnQuantity(1)
      setNewYarnLocation('')
      setNewYarnNickname('')
      setNewYarnNotes('')
      setNewYarnLowStock(false)
      setNewYarnReserved(false)
      await loadInventory()
      setStatus('Yarn item added.')
      setShowAddForm(false)
      return
    }

    if (activeTab === 'hooks') {
      await fetch('/api/scan/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'hooks', ...newHook }),
      })
      setNewHook({ sizeLabel: '', metricSizeMm: '', material: '', quantity: 1 })
      await loadInventory()
      setStatus('Hook added.')
      setShowAddForm(false)
      return
    }

    if (activeTab === 'patterns') {
      const totalUploads = Number(Boolean(newPatternPdfFile)) + Number(Boolean(newPatternCoverFile))
      const response = await fetch('/api/scan/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'patterns', ...newPattern }),
      })
      const payload = (await response.json()) as { message?: string; patternId?: string }
      if (!response.ok) {
        setStatus(payload.message ?? 'Could not add pattern.')
        return
      }

      if (totalUploads > 0) {
        setPatternUploadProgress({
          open: true,
          total: totalUploads,
          completed: 0,
          currentLabel: 'Preparing uploads...',
          error: null,
        })
      }

      if (payload.patternId && newPatternPdfFile) {
        setPatternUploadProgress((current) => ({ ...current, currentLabel: 'Uploading PDF...' }))
        const result = await uploadPatternAsset(payload.patternId, 'pdf', newPatternPdfFile)
        if (!result.ok) {
          setPatternUploadProgress((current) => ({ ...current, error: result.message || 'PDF upload failed.' }))
          return
        }
        setPatternUploadProgress((current) => ({ ...current, completed: current.completed + 1 }))
      }
      if (payload.patternId && newPatternCoverFile) {
        setPatternUploadProgress((current) => ({ ...current, currentLabel: 'Uploading cover image...' }))
        const result = await uploadPatternAsset(payload.patternId, 'cover', newPatternCoverFile)
        if (!result.ok) {
          setPatternUploadProgress((current) => ({ ...current, error: result.message || 'Cover image upload failed.' }))
          return
        }
        setPatternUploadProgress((current) => ({ ...current, completed: current.completed + 1 }))
      }

      setNewPattern({
        title: '',
        description: '',
        sourceUrl: '',
        difficulty: '',
        notes: '',
        isPublic: false,
        publicShareConfirmed: false,
      })
      setNewPatternPdfFile(null)
      setNewPatternCoverFile(null)
      await loadInventory()
      const publicResponse = await fetch('/api/patterns/public')
      if (publicResponse.ok) {
        const publicPayload = (await publicResponse.json()) as PublicPatternsResponse
        setPublicPatterns(publicPayload.patterns ?? [])
      }
      setPatternUploadProgress((current) => ({ ...current, currentLabel: 'Finalizing...', error: null }))
      setStatus('Pattern added.')
      setShowAddForm(false)
      if (totalUploads > 0) {
        setTimeout(() => {
          setPatternUploadProgress({ open: false, total: 0, completed: 0, currentLabel: '', error: null })
        }, 350)
      }
      return
    }

    const creationResponse = await fetch('/api/scan/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'creations',
        ...newCreation,
        patternId: newCreation.patternId || null,
        yarnInventoryIds: newCreationYarnIds,
        hookIds: newCreationHookIds,
      }),
    })
    const creationPayload = (await creationResponse.json()) as { message?: string; creationId?: string }
    if (!creationResponse.ok) {
      setStatus(creationPayload.message ?? 'Could not add creation.')
      return
    }

    if (creationPayload.creationId && newCreationImages.length) {
      const ok = await uploadCreationImages(creationPayload.creationId, newCreationImages)
      if (!ok) {
        return
      }
    }

    setNewCreation({ name: '', status: 'active', patternId: '', notes: '', isPublic: false })
    setNewCreationYarnIds([])
    setNewCreationHookIds([])
    setNewCreationImages([])
    await loadInventory()
    setStatus('Creation added.')
    setShowAddForm(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while saving item.'
      setStatus(message)
      if (activeTab === 'patterns') {
        setPatternUploadProgress((current) => ({
          ...current,
          open: true,
          error: current.error ?? message,
        }))
      }
    } finally {
      setAddingItem(false)
    }
  }

  const removeItem = async (itemId: string) => {
    const response = await fetch('/api/scan/inventory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: activeTab, itemId }),
    })
    if (response.ok) {
      await loadInventory()
      setStatus('Item removed.')
    }
  }

  const statEntries = Object.entries(data?.summary ?? {}).slice(0, 4)

  const setActiveTab = (tab: InventoryKind) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab,
      }),
      replace: true,
    })
  }

  return (
    <section className="page-stack">
      <div className="inventory-tab-row">
        {tabs.map((tab) => (
          <button
            className={`inventory-tab ${activeTab === tab.key ? 'active' : ''}`}
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key)
              setStatus('')
              setShowAddForm(false)
            }}
            type="button"
          >
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="catalog-stat-grid">
        {statEntries.map(([label, value]) => (
          <article className="catalog-stat" key={label}>
            <strong>{value}</strong>
            <span>{label.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}</span>
          </article>
        ))}
      </div>

      <article className="soft-panel inventory-add-shell">
        <div className="hero-actions">
          <h2>Add {tabs.find((tab) => tab.key === activeTab)?.label}</h2>
          <button className="button" onClick={() => setShowAddForm((current) => !current)} type="button">
            <Plus size={14} /> {showAddForm ? 'Hide form' : 'Add'}
          </button>
        </div>
        {showAddForm && activeTab === 'yarn' ? (
          <>
            <form className="catalog-search" onSubmit={searchCatalog}>
              <label>
                Search catalog line
                <input onChange={(event) => setCatalogQuery(event.target.value)} type="text" value={catalogQuery} />
              </label>
              <button className="button" type="submit">
                <Search size={15} /> Find line
              </button>
            </form>
            {catalogLoading ? <p>Searching catalog...</p> : null}
            {catalogResults.length ? (
              <div className="inventory-add-grid">
                <label>
                  Yarn line
                  <select
                    onChange={(event) => {
                      setSelectedLineId(event.target.value)
                      setSelectedColorwayId('')
                    }}
                    value={selectedLineId}
                  >
                    {catalogResults.map((line) => (
                      <option key={line.id} value={line.id}>
                        {line.manufacturerName} · {line.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Colorway
                  <select onChange={(event) => setSelectedColorwayId(event.target.value)} value={selectedColorwayId}>
                    <option value="">Line-level only</option>
                    {(selectedLine?.colorways ?? []).map((colorway) => (
                      <option key={colorway.id} value={colorway.id}>
                        {colorway.name}
                        {colorway.colorCode ? ` (${colorway.colorCode})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    min={1}
                    onChange={(event) => setNewYarnQuantity(Math.max(1, Number(event.target.value) || 1))}
                    type="number"
                    value={newYarnQuantity}
                  />
                </label>
                <label>
                  Storage
                  <input onChange={(event) => setNewYarnLocation(event.target.value)} type="text" value={newYarnLocation} />
                </label>
                <label>
                  Nickname
                  <input onChange={(event) => setNewYarnNickname(event.target.value)} type="text" value={newYarnNickname} />
                </label>
                <label>
                  Notes
                  <input onChange={(event) => setNewYarnNotes(event.target.value)} type="text" value={newYarnNotes} />
                </label>
                <label className="inventory-toggle-label">
                  <input checked={newYarnLowStock} onChange={(event) => setNewYarnLowStock(event.target.checked)} type="checkbox" />
                  Low stock
                </label>
                <label className="inventory-toggle-label">
                  <input checked={newYarnReserved} onChange={(event) => setNewYarnReserved(event.target.checked)} type="checkbox" />
                  Reserved for project
                </label>
              </div>
            ) : null}
          </>
        ) : null}

        {showAddForm && activeTab === 'hooks' ? (
          <div className="inventory-add-grid">
            <label>
              Size label
              <input onChange={(event) => setNewHook((current) => ({ ...current, sizeLabel: event.target.value }))} type="text" value={newHook.sizeLabel} />
            </label>
            <label>
              Metric mm
              <input onChange={(event) => setNewHook((current) => ({ ...current, metricSizeMm: event.target.value }))} type="text" value={newHook.metricSizeMm} />
            </label>
            <label>
              Material
              <input onChange={(event) => setNewHook((current) => ({ ...current, material: event.target.value }))} type="text" value={newHook.material} />
            </label>
            <label>
              Quantity
              <input min={1} onChange={(event) => setNewHook((current) => ({ ...current, quantity: Math.max(1, Number(event.target.value) || 1) }))} type="number" value={newHook.quantity} />
            </label>
          </div>
        ) : null}

        {showAddForm && activeTab === 'patterns' ? (
          <div className="inventory-add-grid">
            <label>
              Title
              <input onChange={(event) => setNewPattern((current) => ({ ...current, title: event.target.value }))} type="text" value={newPattern.title} />
            </label>
            <label>
              Description
              <textarea onChange={(event) => setNewPattern((current) => ({ ...current, description: event.target.value }))} rows={4} value={newPattern.description} />
            </label>
            <label>
              Source URL
              <input onChange={(event) => setNewPattern((current) => ({ ...current, sourceUrl: event.target.value }))} type="text" value={newPattern.sourceUrl} />
            </label>
            <label>
              Difficulty
              <input onChange={(event) => setNewPattern((current) => ({ ...current, difficulty: event.target.value }))} type="text" value={newPattern.difficulty} />
            </label>
            <label>
              Notes
              <input onChange={(event) => setNewPattern((current) => ({ ...current, notes: event.target.value }))} type="text" value={newPattern.notes} />
            </label>
            <label>
              Pattern PDF (optional)
              <FileDropInput accept="application/pdf" onSelect={(files) => setNewPatternPdfFile(files[0] ?? null)} />
            </label>
            <label>
              Cover image (optional)
              <FileDropInput
                accept="image/jpeg,image/png,image/webp,image/gif"
                onSelect={(files) => setNewPatternCoverFile(files[0] ?? null)}
              />
            </label>
            <label className="inventory-toggle-label">
              <input
                checked={newPattern.isPublic}
                onChange={(event) => setNewPattern((current) => ({ ...current, isPublic: event.target.checked }))}
                type="checkbox"
              />
              Make pattern public (free download)
            </label>
            {newPattern.isPublic ? (
              <label className="inventory-toggle-label">
                <input
                  checked={newPattern.publicShareConfirmed}
                  onChange={(event) =>
                    setNewPattern((current) => ({
                      ...current,
                      publicShareConfirmed: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                I am the creator or I have express permission to share this pattern publicly.
              </label>
            ) : null}
          </div>
        ) : null}

        {showAddForm && activeTab === 'creations' ? (
          <div className="inventory-add-grid">
            <label>
              Name
              <input onChange={(event) => setNewCreation((current) => ({ ...current, name: event.target.value }))} type="text" value={newCreation.name} />
            </label>
            <label>
              Status
              <select onChange={(event) => setNewCreation((current) => ({ ...current, status: event.target.value }))} value={newCreation.status}>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="finished">finished</option>
              </select>
            </label>
            <label>
              Pattern
              <select onChange={(event) => setNewCreation((current) => ({ ...current, patternId: event.target.value }))} value={newCreation.patternId}>
                <option value="">No pattern</option>
                {patternChoices.map((pattern) => (
                  <option key={pattern.id} value={pattern.id}>
                    {pattern.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <textarea onChange={(event) => setNewCreation((current) => ({ ...current, notes: event.target.value }))} rows={5} value={newCreation.notes} />
            </label>
            <label>
              Creation images (up to 8)
              <FileDropInput
                accept="image/jpeg,image/png,image/webp,image/gif"
                hint="Drag and drop creation images, or click to choose"
                multiple
                onSelect={(files) => setNewCreationImages(files)}
              />
            </label>
            <label className="inventory-toggle-label">
              <input
                checked={newCreation.isPublic}
                onChange={(event) => setNewCreation((current) => ({ ...current, isPublic: event.target.checked }))}
                type="checkbox"
              />
              Make creation public in Discover
            </label>
            <SearchableMultiSelect
              label="Yarn from inventory"
              onChange={setNewCreationYarnIds}
              options={creationYarnOptions}
              placeholder="Search yarn in stash"
              selectedIds={newCreationYarnIds}
            />
            <SearchableMultiSelect
              label="Hooks from inventory"
              onChange={setNewCreationHookIds}
              options={creationHookOptions}
              placeholder="Search hooks"
              selectedIds={newCreationHookIds}
            />
          </div>
        ) : null}

        {showAddForm ? (
          <button className="button button-primary" disabled={addingItem} onClick={() => void addCurrentItem()} type="button">
            <Plus size={15} /> {addingItem ? 'Saving...' : 'Add item'}
          </button>
        ) : null}
      </article>

      <section className="catalog-list-shell" aria-label="Inventory list">
        <form
          className="catalog-search inventory-search"
          onSubmit={(event) => {
            event.preventDefault()
            setQuery(queryInput.trim())
          }}
        >
          <label>
            Search {activeTab}
            <input onChange={(event) => setQueryInput(event.target.value)} type="text" value={queryInput} />
          </label>
          <button className="button" type="submit">
            <Search size={15} /> Filter
          </button>
        </form>

        {loading ? <p className="inventory-message">Loading...</p> : null}
        {error ? <p className="inventory-message">{error}</p> : null}
        {status ? <p className="inventory-message">{status}</p> : null}

        {patternUploadProgress.open ? (
          <div className="modal-backdrop" role="presentation">
            <div aria-label="Pattern upload progress" aria-modal="true" className="community-modal" role="dialog">
              <div className="community-modal-head">
                <h3>Uploading pattern files</h3>
              </div>
              <div className="stack-form">
                <p>{patternUploadProgress.completed}/{patternUploadProgress.total} files uploaded</p>
                <p>{patternUploadProgress.currentLabel}</p>
                {patternUploadProgress.error ? <p>{patternUploadProgress.error}</p> : null}
                <div className="hero-actions">
                  {patternUploadProgress.error ? (
                    <button
                      className="button"
                      onClick={() => setPatternUploadProgress({ open: false, total: 0, completed: 0, currentLabel: '', error: null })}
                      type="button"
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !error && data && data.items.length === 0 ? <p className="inventory-message">No items yet.</p> : null}

        {!loading && !error && data?.kind === 'yarn'
          ? (data.items as YarnItem[]).map((item) => (
              <article className="inventory-row" key={item.id}>
                <div className="inventory-row-title">
                  <strong>
                    {item.manufacturerName ?? 'Unknown manufacturer'} · {item.lineName ?? 'Unknown line'}
                  </strong>
                  <span>
                    {item.colorwayName ?? 'No colorway'}
                    {item.colorCode ? ` (${item.colorCode})` : ''}
                    {item.isLowStock ? ' · Low stock' : ''}
                    {item.isProjectReserved ? ' · Reserved' : ''}
                  </span>
                </div>

                <div className="inventory-qty-control">
                  <button className="button" onClick={() => void adjustYarnQuantity(item.id, -1)} type="button">
                    <Minus size={14} />
                  </button>
                  <input readOnly type="number" value={item.quantity} />
                  <button className="button" onClick={() => void adjustYarnQuantity(item.id, 1)} type="button">
                    <Plus size={14} />
                  </button>
                </div>

                <label>
                  Storage
                  <input
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: { ...current[item.id], storageLocation: event.target.value },
                      }))
                    }
                    type="text"
                    value={String((drafts[item.id]?.storageLocation as string | undefined) ?? item.storageLocation ?? '')}
                  />
                </label>

                <label>
                  Nickname
                  <input
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: { ...current[item.id], nickname: event.target.value },
                      }))
                    }
                    type="text"
                    value={String((drafts[item.id]?.nickname as string | undefined) ?? item.nickname ?? '')}
                  />
                </label>

                <label>
                  Notes
                  <input
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: { ...current[item.id], notes: event.target.value },
                      }))
                    }
                    type="text"
                    value={String((drafts[item.id]?.notes as string | undefined) ?? item.notes ?? '')}
                  />
                </label>

                <div className="inventory-flag-group">
                  <label className="inventory-toggle-label">
                    <input
                      checked={Boolean((drafts[item.id]?.isLowStock as boolean | undefined) ?? item.isLowStock)}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], isLowStock: event.target.checked },
                        }))
                      }
                      type="checkbox"
                    />
                    Low stock
                  </label>
                  <label className="inventory-toggle-label">
                    <input
                      checked={Boolean((drafts[item.id]?.isProjectReserved as boolean | undefined) ?? item.isProjectReserved)}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], isProjectReserved: event.target.checked },
                        }))
                      }
                      type="checkbox"
                    />
                    Reserved
                  </label>
                </div>

                <div className="hero-actions">
                  <button className="button" onClick={() => void patchItem(item.id, drafts[item.id] ?? {})} type="button">
                    <Save size={14} /> Save
                  </button>
                  <button className="button" onClick={() => void removeItem(item.id)} type="button">
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </article>
            ))
          : null}

        {!loading && !error && data?.kind === 'hooks'
          ? (data.items as HookItem[]).map((item) => (
              <article className="inventory-simple-row" key={item.id}>
                <label>
                  Size
                  <input onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], sizeLabel: event.target.value } }))} type="text" value={String((drafts[item.id]?.sizeLabel as string | undefined) ?? item.sizeLabel)} />
                </label>
                <label>
                  Metric
                  <input onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], metricSizeMm: event.target.value } }))} type="text" value={String((drafts[item.id]?.metricSizeMm as string | undefined) ?? item.metricSizeMm ?? '')} />
                </label>
                <label>
                  Material
                  <input onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], material: event.target.value } }))} type="text" value={String((drafts[item.id]?.material as string | undefined) ?? item.material ?? '')} />
                </label>
                <label>
                  Qty
                  <input min={1} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], quantity: Math.max(1, Number(event.target.value) || 1) } }))} type="number" value={Number((drafts[item.id]?.quantity as number | undefined) ?? item.quantity)} />
                </label>
                <div className="hero-actions">
                  <button className="button" onClick={() => void patchItem(item.id, drafts[item.id] ?? {})} type="button">
                    <Save size={14} /> Save
                  </button>
                  <button className="button" onClick={() => void removeItem(item.id)} type="button">
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </article>
            ))
          : null}

        {!loading && !error && data?.kind === 'patterns'
          ? (data.items as PatternItem[]).map((item) => (
              <article className="pattern-card" key={item.id}>
                <button className="pattern-menu-trigger" onClick={() => setPatternMenuOpenId((curr) => (curr === item.id ? null : item.id))} type="button">
                  <Ellipsis size={16} />
                </button>
                {patternMenuOpenId === item.id ? (
                  <div className="pattern-menu-popover">
                    <button className="button" onClick={() => { setEditingPatternId((curr) => (curr === item.id ? null : item.id)); setPatternMenuOpenId(null) }} type="button">
                      <Save size={14} /> Edit
                    </button>
                    <button className="button" onClick={() => void removeItem(item.id)} type="button">
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                ) : null}

                <a className="pattern-card-link" href={item.hasPdf ? `/api/patterns/${item.id}/file` : undefined}>
                  {item.hasCover ? (
                    <img alt={item.title} className="pattern-card-cover" src={`/api/patterns/${item.id}/cover`} />
                  ) : (
                    <div className="pattern-card-cover pattern-card-cover-fallback">
                      <BookOpenCheck size={20} />
                    </div>
                  )}
                  <div className="pattern-card-body">
                    <strong>{item.title}</strong>
                    <span>{item.description || 'No description yet.'}</span>
                    <span>{item.difficulty || 'No difficulty'} · {item.isPublic ? 'Public' : 'Private'} · {item.hasPdf ? 'PDF ready' : 'No PDF'}</span>
                  </div>
                </a>

                {editingPatternId === item.id ? (
                  <div className="pattern-card-editor">
                    <label>
                      Title
                      <input onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], title: event.target.value } }))} type="text" value={String((drafts[item.id]?.title as string | undefined) ?? item.title)} />
                    </label>
                    <label>
                      Description
                      <textarea onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], description: event.target.value } }))} rows={3} value={String((drafts[item.id]?.description as string | undefined) ?? item.description ?? '')} />
                    </label>
                    <label>
                      Source URL
                      <input onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], sourceUrl: event.target.value } }))} type="text" value={String((drafts[item.id]?.sourceUrl as string | undefined) ?? item.sourceUrl ?? '')} />
                    </label>
                    <label>
                      Difficulty
                      <input onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], difficulty: event.target.value } }))} type="text" value={String((drafts[item.id]?.difficulty as string | undefined) ?? item.difficulty ?? '')} />
                    </label>
                    <label>
                      Notes
                      <textarea onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], notes: event.target.value } }))} rows={3} value={String((drafts[item.id]?.notes as string | undefined) ?? item.notes ?? '')} />
                    </label>
                    <label className="inventory-toggle-label">
                      <input
                        checked={Boolean((drafts[item.id]?.isPublic as boolean | undefined) ?? item.isPublic)}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], isPublic: event.target.checked },
                          }))
                        }
                        type="checkbox"
                      />
                      Make public (free download)
                    </label>
                    <label className="inventory-toggle-label">
                      <input
                        checked={Boolean((drafts[item.id]?.publicShareConfirmed as boolean | undefined) ?? item.publicShareConfirmed)}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], publicShareConfirmed: event.target.checked },
                          }))
                        }
                        type="checkbox"
                      />
                      I am creator / have permission
                    </label>
                    <div className="pattern-assets-row">
                      <label>
                        {item.hasPdf ? 'Replace PDF' : 'Upload PDF'}
                        <FileDropInput
                          accept="application/pdf"
                          onSelect={async (files) => {
                            const file = files[0]
                            if (!file) return
                            const result = await uploadPatternAsset(item.id, 'pdf', file)
                            if (result.ok) {
                              await loadInventory()
                              setStatus(item.hasPdf ? 'Pattern PDF replaced.' : 'Pattern PDF uploaded.')
                            }
                          }}
                        />
                      </label>
                      <label>
                        {item.hasCover ? 'Replace cover' : 'Upload cover'}
                        <FileDropInput
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onSelect={async (files) => {
                            const file = files[0]
                            if (!file) return
                            const result = await uploadPatternAsset(item.id, 'cover', file)
                            if (result.ok) {
                              await loadInventory()
                              setStatus(item.hasCover ? 'Pattern cover replaced.' : 'Pattern cover uploaded.')
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="hero-actions">
                      {item.hasPdf ? (
                        <a className="button" href={`/api/patterns/${item.id}/file`}>
                          <Download size={14} /> View PDF
                        </a>
                      ) : null}
                      {item.hasCover ? (
                        <a className="button" href={`/api/patterns/${item.id}/cover`} rel="noreferrer" target="_blank">
                          <ImagePlus size={14} /> View cover
                        </a>
                      ) : null}
                    </div>
                    <div className="hero-actions">
                      <button className="button" onClick={() => void patchItem(item.id, drafts[item.id] ?? {})} type="button"><Save size={14} /> Save</button>
                      <button className="button" onClick={() => setEditingPatternId(null)} type="button">Done</button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))
          : null}

        {!loading && !error && activeTab === 'patterns' ? (
          <article className="soft-panel public-patterns-shell">
            <h3>Public Pattern Library</h3>
            <p>Any public pattern listed here is downloadable for free by all signed-in members.</p>
            <div className="catalog-sublist">
              {publicPatterns.length ? (
                publicPatterns.map((pattern) => (
                  <div className="catalog-subrow" key={pattern.id}>
                    <div>
                      <strong>{pattern.title}</strong>
                      <span>
                        by {pattern.ownerDisplayName}
                        {pattern.difficulty ? ` · ${pattern.difficulty}` : ''}
                        {pattern.description ? ` · ${pattern.description}` : ''}
                      </span>
                    </div>
                    <div className="hero-actions">
                      {pattern.hasPdf ? (
                        <a className="button" href={`/api/patterns/${pattern.id}/file`}>
                          <Download size={14} /> Free download
                        </a>
                      ) : null}
                      <button
                        className="button"
                        onClick={async () => {
                          const details = window.prompt('Optional: explain why this public pattern may not be authorized.') ?? ''
                          const response = await fetch(`/api/patterns/${pattern.id}/claim`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ details: details.trim() || null }),
                          })
                          const payload = (await response.json()) as { message?: string }
                          setStatus(payload.message ?? (response.ok ? 'Claim filed.' : 'Could not file claim.'))
                        }}
                        type="button"
                      >
                        <Lock size={14} /> File claim
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p>No public patterns published yet.</p>
              )}
            </div>
          </article>
        ) : null}

        {!loading && !error && data?.kind === 'creations'
          ? (data.items as CreationItem[]).map((item) => (
              <article className="pattern-row" key={item.id}>
                <div className="pattern-row-head">
                  <strong>{item.name}</strong>
                  <span>
                    {item.status} · {item.isPublic ? 'Public' : 'Private'} · {item.yarnCount} yarn · {item.hookCount} hooks · {item.imageCount} images
                    {item.moderationStatus !== 'active' ? ` · Removed by admin${item.moderationReason ? ` (${item.moderationReason})` : ''}` : ''}
                  </span>
                </div>
                <label>
                  Name
                  <input onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], name: event.target.value } }))} type="text" value={String((drafts[item.id]?.name as string | undefined) ?? item.name)} />
                </label>
                <label>
                  Status
                  <select onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], status: event.target.value } }))} value={String((drafts[item.id]?.status as string | undefined) ?? item.status)}>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="finished">finished</option>
                  </select>
                </label>
                <label>
                  Pattern
                  <select onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], patternId: event.target.value } }))} value={String((drafts[item.id]?.patternId as string | undefined) ?? item.patternId ?? '')}>
                    <option value="">No pattern</option>
                    {patternChoices.map((pattern) => (
                      <option key={pattern.id} value={pattern.id}>
                        {pattern.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Notes
                  <textarea onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], notes: event.target.value } }))} rows={5} value={String((drafts[item.id]?.notes as string | undefined) ?? item.notes ?? '')} />
                </label>
                <label className="inventory-toggle-label">
                  <input
                    checked={Boolean((drafts[item.id]?.isPublic as boolean | undefined) ?? item.isPublic)}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: { ...current[item.id], isPublic: event.target.checked },
                      }))
                    }
                    type="checkbox"
                  />
                  Public in Discover
                </label>
                <label>
                  Add images
                  <FileDropInput
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hint="Drag and drop creation images, or click to choose"
                    multiple
                    onSelect={async (files) => {
                      if (!files.length) {
                        return
                      }
                      const ok = await uploadCreationImages(item.id, files)
                      if (ok) {
                        await loadInventory()
                        setStatus('Creation images uploaded.')
                      }
                    }}
                  />
                </label>
                <div className="hero-actions">
                  {item.imageCount ? <a className="button" href={`/api/creations/${item.id}/images`} target="_blank" rel="noreferrer">View images</a> : null}
                </div>
                <div className="hero-actions">
                  <button className="button" onClick={() => void patchItem(item.id, drafts[item.id] ?? {})} type="button">
                    <Save size={14} /> Save
                  </button>
                  <button className="button" onClick={() => void removeItem(item.id)} type="button">
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </article>
            ))
          : null}
      </section>
    </section>
  )
}

function SearchableMultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
}: {
  label: string
  options: Array<{ id: string; label: string }>
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return options
    }
    return options.filter((option) => option.label.toLowerCase().includes(q))
  }, [options, query])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedLabels = options.filter((option) => selectedSet.has(option.id)).map((option) => option.label)

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((value) => value !== id))
      return
    }
    onChange([...selectedIds, id])
  }

  return (
    <div className="searchable-multiselect">
      <label>{label}</label>
      <input onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} type="text" value={query} />
      {selectedLabels.length ? (
        <div className="searchable-selected-list">
          {selectedLabels.slice(0, 3).map((value) => (
            <span className="searchable-selected-chip" key={value}>
              {value}
            </span>
          ))}
          {selectedLabels.length > 3 ? <span className="searchable-selected-chip">+{selectedLabels.length - 3} more</span> : null}
        </div>
      ) : null}
      <div className="searchable-options-list" role="listbox" aria-label={label}>
        {filtered.length ? (
          filtered.slice(0, 80).map((option) => (
            <label className="searchable-option-item" key={option.id}>
              <input checked={selectedSet.has(option.id)} onChange={() => toggle(option.id)} type="checkbox" />
              <span>{option.label}</span>
            </label>
          ))
        ) : (
          <p className="inventory-message">No matches.</p>
        )}
      </div>
    </div>
  )
}
