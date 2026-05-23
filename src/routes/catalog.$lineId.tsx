import { createFileRoute } from '@tanstack/react-router'
import { Pencil, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { CommentThread } from '#/components/comment-thread'

export const Route = createFileRoute('/catalog/$lineId')({ component: CatalogLinePage })

type LineDetailResponse = {
  canAdminEdit?: boolean
  line: {
    id: string
    name: string
    manufacturerId: string
    manufacturerName: string
    weightClass: string | null
    fiberContent: string | null
    yardageMeters: number | null
    needleOrHookRange: string | null
    productUrl: string | null
  }
  colorways: Array<{ id: string; name: string; colorCode: string | null; hexReference: string | null }>
  barcodes: Array<{
    id: string
    barcodeValue: string
    format: string
    colorwayId: string | null
    colorwayName: string | null
    colorCode: string | null
  }>
}

type Claim = {
  id: string
  fieldKey: string | null
  proposedValue: string | null
  notes: string | null
  status: string
  createdByName: string
  agreeCount: number
  disagreeCount: number
  userVote: 'agree' | 'disagree' | null
}

type ClaimsResponse = {
  claims: Claim[]
}

type EditTarget = {
  entityType: 'yarn_line' | 'colorway'
  entityId: string
  fieldKey: string
  label: string
}

const fieldDefinitions: Array<{ key: EditableFieldKey; label: string }> = [
  { key: 'name', label: 'Line name' },
  { key: 'weightClass', label: 'Weight class' },
  { key: 'fiberContent', label: 'Fiber content' },
  { key: 'yardageMeters', label: 'Yardage meters' },
  { key: 'needleOrHookRange', label: 'Needle / Hook range' },
  { key: 'productUrl', label: 'Manufacturer page link' },
]

const colorwayFieldOptions: Array<{ key: 'name' | 'colorCode' | 'hexReference'; label: string }> = [
  { key: 'name', label: 'Colorway name' },
  { key: 'colorCode', label: 'Color code' },
  { key: 'hexReference', label: 'Hex reference' },
]

type EditableFieldKey = 'name' | 'weightClass' | 'fiberContent' | 'yardageMeters' | 'needleOrHookRange' | 'productUrl'

function CatalogLinePage() {
  const { lineId } = Route.useParams()
  const [data, setData] = useState<LineDetailResponse | null>(null)
  const [claimsData, setClaimsData] = useState<ClaimsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [communityMessage, setCommunityMessage] = useState<string | null>(null)
  const [editingTarget, setEditingTarget] = useState<EditTarget | null>(null)
  const [proposedValue, setProposedValue] = useState('')
  const [proposedNotes, setProposedNotes] = useState('')
  const [colorwayAddDraft, setColorwayAddDraft] = useState({ name: '', colorCode: '', hexReference: '' })
  const [modalClaims, setModalClaims] = useState<Claim[]>([])
  const [modalClaimsLoading, setModalClaimsLoading] = useState(false)
  const [adminStatus, setAdminStatus] = useState<string | null>(null)
  const [lineDraft, setLineDraft] = useState({
    manufacturerName: '',
    name: '',
    weightClass: '',
    fiberContent: '',
    yardageMeters: '',
    needleOrHookRange: '',
    productUrl: '',
  })
  const [colorwayDrafts, setColorwayDrafts] = useState<Record<string, { name: string; colorCode: string; hexReference: string }>>({})
  const [barcodeDrafts, setBarcodeDrafts] = useState<Record<string, { barcodeValue: string; colorwayId: string }>>({})

  useEffect(() => {
    void loadLineDetail(lineId, setData, setLoading, setError)
  }, [lineId])

  useEffect(() => {
    void loadClaims(lineId, setClaimsData)
  }, [lineId])

  useEffect(() => {
    if (!data) {
      return
    }
    setLineDraft({
      manufacturerName: data.line.manufacturerName,
      name: data.line.name,
      weightClass: data.line.weightClass ?? '',
      fiberContent: data.line.fiberContent ?? '',
      yardageMeters: data.line.yardageMeters ? String(data.line.yardageMeters) : '',
      needleOrHookRange: data.line.needleOrHookRange ?? '',
      productUrl: data.line.productUrl ?? '',
    })
    setColorwayDrafts(
      Object.fromEntries(
        data.colorways.map((item) => [item.id, { name: item.name, colorCode: item.colorCode ?? '', hexReference: item.hexReference ?? '' }]),
      ),
    )
    setBarcodeDrafts(
      Object.fromEntries(
        data.barcodes.map((item) => [item.id, { barcodeValue: item.barcodeValue, colorwayId: item.colorwayId ?? '' }]),
      ),
    )
  }, [data])

  const claimsByField = useMemo(() => {
    const map = new Map<string, Claim[]>()
    for (const claim of claimsData?.claims ?? []) {
      const key = claim.fieldKey ?? 'general'
      const list = map.get(key) ?? []
      list.push(claim)
      map.set(key, list)
    }
    return map
  }, [claimsData])

  const openLineFieldModal = async (field: EditableFieldKey) => {
    const label = fieldDefinitions.find((item) => item.key === field)?.label ?? field
    setEditingTarget({ entityType: 'yarn_line', entityId: lineId, fieldKey: field, label })
    setProposedValue('')
    setProposedNotes('')
    setColorwayAddDraft({ name: '', colorCode: '', hexReference: '' })
    setCommunityMessage(null)
    await loadModalClaims('yarn_line', lineId, field, setModalClaims, setModalClaimsLoading)
  }

  const openColorwayFieldModal = async (colorwayId: string, field: 'name' | 'colorCode' | 'hexReference', label: string) => {
    setEditingTarget({ entityType: 'colorway', entityId: colorwayId, fieldKey: field, label })
    setProposedValue('')
    setProposedNotes('')
    setColorwayAddDraft({ name: '', colorCode: '', hexReference: '' })
    setCommunityMessage(null)
    await loadModalClaims('colorway', colorwayId, field, setModalClaims, setModalClaimsLoading)
  }

  const changeColorwayModalField = async (field: 'name' | 'colorCode' | 'hexReference') => {
    if (!editingTarget || editingTarget.entityType !== 'colorway') {
      return
    }

    const label = colorwayFieldOptions.find((item) => item.key === field)?.label ?? field
    const nextTarget: EditTarget = {
      ...editingTarget,
      fieldKey: field,
      label,
    }
    setEditingTarget(nextTarget)
    await loadModalClaims(nextTarget.entityType, nextTarget.entityId, nextTarget.fieldKey, setModalClaims, setModalClaimsLoading)
  }

  const openAddColorwayModal = async () => {
    setEditingTarget({ entityType: 'yarn_line', entityId: lineId, fieldKey: 'colorway_add', label: 'Add colorway' })
    setProposedValue('')
    setProposedNotes('')
    setColorwayAddDraft({ name: '', colorCode: '', hexReference: '' })
    setCommunityMessage(null)
    await loadModalClaims('yarn_line', lineId, 'colorway_add', setModalClaims, setModalClaimsLoading)
  }

  const closeModal = () => {
    setEditingTarget(null)
    setModalClaims([])
  }

  const submitCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingTarget) {
      return
    }

    let finalValue = proposedValue.trim()
    if (editingTarget.fieldKey === 'colorway_add') {
      if (!colorwayAddDraft.name.trim()) {
        setCommunityMessage('Colorway name is required.')
        return
      }
      finalValue = JSON.stringify({
        name: colorwayAddDraft.name.trim(),
        colorCode: colorwayAddDraft.colorCode.trim() || null,
        hexReference: colorwayAddDraft.hexReference.trim() || null,
      })
    } else if (!finalValue) {
      setCommunityMessage('Please enter a proposed value.')
      return
    }

    const response = await fetch('/api/community/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: editingTarget.entityType,
        entityId: editingTarget.entityId,
        fieldKey: editingTarget.fieldKey,
        proposedValue: finalValue,
        notes: proposedNotes.trim() || null,
      }),
    })

    const payload = (await response.json()) as { message?: string }
    setCommunityMessage(payload.message ?? (response.ok ? 'Suggestion submitted.' : 'Could not submit suggestion.'))

    if (response.ok) {
      setProposedValue('')
      setProposedNotes('')
        setColorwayAddDraft({ name: '', colorCode: '', hexReference: '' })
      await Promise.all([
        loadClaims(lineId, setClaimsData),
        loadLineDetail(lineId, setData, setLoading, setError),
      ])
      if (editingTarget) {
        await loadModalClaims(
          editingTarget.entityType,
          editingTarget.entityId,
          editingTarget.fieldKey,
          setModalClaims,
          setModalClaimsLoading,
        )
      }
    }
  }

  const voteOnClaim = async (claimId: string, vote: 'agree' | 'disagree') => {
    const response = await fetch(`/api/community/claims/${claimId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    })

    const payload = (await response.json()) as { message?: string }
    setCommunityMessage(payload.message ?? (response.ok ? 'Vote saved.' : 'Could not save vote.'))

    if (response.ok) {
      await Promise.all([
        loadClaims(lineId, setClaimsData),
        loadLineDetail(lineId, setData, setLoading, setError),
      ])
      if (editingTarget) {
        await loadModalClaims(
          editingTarget.entityType,
          editingTarget.entityId,
          editingTarget.fieldKey,
          setModalClaims,
          setModalClaimsLoading,
        )
      }
    }
  }

  const flagBarcode = async (barcodeId: string, barcodeValue: string) => {
    const details = window.prompt('Optional: describe the mismatch issue for this barcode.') ?? ''
    const response = await fetch('/api/community/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'barcode_association',
        entityId: barcodeId,
        reason: 'wrong_association',
        details: details || `User flagged barcode ${barcodeValue} as incorrect association.`,
      }),
    })

    const payload = (await response.json()) as { message?: string }
    setCommunityMessage(payload.message ?? (response.ok ? 'Flag submitted.' : 'Could not submit flag.'))
  }

  const saveAdminLine = async () => {
    const response = await fetch(`/api/catalog/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'line',
        manufacturerName: lineDraft.manufacturerName,
        name: lineDraft.name,
        weightClass: lineDraft.weightClass,
        fiberContent: lineDraft.fiberContent,
        yardageMeters: lineDraft.yardageMeters ? Number(lineDraft.yardageMeters) : null,
        needleOrHookRange: lineDraft.needleOrHookRange,
        productUrl: lineDraft.productUrl,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    setAdminStatus(payload.message ?? (response.ok ? 'Saved.' : 'Could not save line.'))
    if (response.ok) {
      await loadLineDetail(lineId, setData, setLoading, setError)
    }
  }

  const saveAdminColorway = async (colorwayId: string) => {
    const draft = colorwayDrafts[colorwayId]
    if (!draft) return
    const response = await fetch(`/api/catalog/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'colorway', entityId: colorwayId, ...draft }),
    })
    const payload = (await response.json()) as { message?: string }
    setAdminStatus(payload.message ?? (response.ok ? 'Saved.' : 'Could not save colorway.'))
    if (response.ok) {
      await loadLineDetail(lineId, setData, setLoading, setError)
    }
  }

  const deleteAdminColorway = async (colorwayId: string) => {
    const response = await fetch(`/api/catalog/${lineId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'colorway', entityId: colorwayId }),
    })
    const payload = (await response.json()) as { message?: string }
    setAdminStatus(payload.message ?? (response.ok ? 'Deleted.' : 'Could not delete colorway.'))
    if (response.ok) {
      await loadLineDetail(lineId, setData, setLoading, setError)
    }
  }

  const saveAdminBarcode = async (barcodeId: string) => {
    const draft = barcodeDrafts[barcodeId]
    if (!draft) return
    const response = await fetch(`/api/catalog/${lineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'barcode',
        entityId: barcodeId,
        barcodeValue: draft.barcodeValue,
        colorwayId: draft.colorwayId || null,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    setAdminStatus(payload.message ?? (response.ok ? 'Saved.' : 'Could not save barcode.'))
    if (response.ok) {
      await loadLineDetail(lineId, setData, setLoading, setError)
    }
  }

  const deleteAdminBarcode = async (barcodeId: string) => {
    const response = await fetch(`/api/catalog/${lineId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'barcode', entityId: barcodeId }),
    })
    const payload = (await response.json()) as { message?: string }
    setAdminStatus(payload.message ?? (response.ok ? 'Deleted.' : 'Could not delete barcode.'))
    if (response.ok) {
      await loadLineDetail(lineId, setData, setLoading, setError)
    }
  }

  const deleteAdminLine = async () => {
    const ok = window.confirm('Delete this yarn line and all associated colorways/barcodes? This cannot be undone.')
    if (!ok) return
    const response = await fetch(`/api/catalog/${lineId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'line' }),
    })
    const payload = (await response.json()) as { message?: string }
    setAdminStatus(payload.message ?? (response.ok ? 'Line deleted.' : 'Could not delete line.'))
    if (response.ok) {
      window.location.assign('/catalog')
    }
  }

  const deleteAdminManufacturer = async () => {
    const typed = window.prompt(`Type the manufacturer name to confirm delete: ${data?.line.manufacturerName ?? ''}`) ?? ''
    if (!typed.trim()) return
    const response = await fetch(`/api/catalog/${lineId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'manufacturer', confirmName: typed.trim() }),
    })
    const payload = (await response.json()) as { message?: string }
    setAdminStatus(payload.message ?? (response.ok ? 'Manufacturer deleted.' : 'Could not delete manufacturer.'))
    if (response.ok) {
      window.location.assign('/catalog')
    }
  }

  const getDisplayValue = (field: EditableFieldKey, baseValue: string | number | null) => {
    const claims = claimsByField.get(field) ?? []
    const winner = [...claims]
      .filter((claim) => Boolean(claim.proposedValue))
      .sort((a, b) => {
        const scoreA = a.agreeCount - a.disagreeCount
        const scoreB = b.agreeCount - b.disagreeCount
        if (scoreA !== scoreB) {
          return scoreB - scoreA
        }
        return b.agreeCount - a.agreeCount
      })[0]

    if (winner && winner.agreeCount > 0 && winner.agreeCount >= winner.disagreeCount) {
      return winner.proposedValue ?? 'Unknown'
    }

    if (baseValue === null || baseValue === '') {
      return 'Unknown'
    }
    return String(baseValue)
  }

  return (
    <section className="page-stack">
      {loading ? <p>Loading line details...</p> : null}
      {error ? <p>{error}</p> : null}

      {!loading && !error && data ? (
        <>
          {communityMessage ? <p>{communityMessage}</p> : null}

          <section className="catalog-detail-grid">
            <article className="soft-panel">
              <h2>Line details</h2>
              <div className="editable-field-row">
                <strong>Line name</strong>
                <span>{getDisplayValue('name', data.line.name)}</span>
                <button className="icon-button" onClick={() => void openLineFieldModal('name')} type="button">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="editable-field-row">
                <strong>Weight class</strong>
                <span>{getDisplayValue('weightClass', data.line.weightClass)}</span>
                <button className="icon-button" onClick={() => void openLineFieldModal('weightClass')} type="button">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="editable-field-row">
                <strong>Fiber content</strong>
                <span>{getDisplayValue('fiberContent', data.line.fiberContent)}</span>
                <button className="icon-button" onClick={() => void openLineFieldModal('fiberContent')} type="button">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="editable-field-row">
                <strong>Yardage meters</strong>
                <span>{getDisplayValue('yardageMeters', data.line.yardageMeters)}</span>
                <button className="icon-button" onClick={() => void openLineFieldModal('yardageMeters')} type="button">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="editable-field-row">
                <strong>Needle / Hook</strong>
                <span>{getDisplayValue('needleOrHookRange', data.line.needleOrHookRange)}</span>
                <button className="icon-button" onClick={() => void openLineFieldModal('needleOrHookRange')} type="button">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="editable-field-row">
                <strong>Manufacturer page</strong>
                <span>{getDisplayValue('productUrl', data.line.productUrl)}</span>
                <button className="icon-button" onClick={() => void openLineFieldModal('productUrl')} type="button">
                  <Pencil size={14} />
                </button>
              </div>
            </article>

            <article className="soft-panel">
              <h2>Colorways ({data.colorways.length})</h2>
              <button className="button" onClick={() => void openAddColorwayModal()} type="button">
                <Pencil size={14} /> Suggest new colorway
              </button>
              <div className="catalog-sublist">
                {data.colorways.length ? (
                  data.colorways.map((item) => (
                    <div className="catalog-subrow" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.colorCode ?? item.hexReference ?? 'No color code'}</span>
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => void openColorwayFieldModal(item.id, 'name', `Colorway (${item.name})`)}
                        type="button"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p>No colorways recorded yet.</p>
                )}
              </div>
            </article>
          </section>

          <article className="soft-panel">
            <h2>Barcodes ({data.barcodes.length})</h2>
            <div className="catalog-sublist">
              {data.barcodes.length ? (
                data.barcodes.map((item) => (
                  <div className="catalog-subrow" key={item.id}>
                    <div>
                      <strong>{item.barcodeValue}</strong>
                      <span>
                        {item.format} ·{' '}
                        {item.colorwayName
                          ? `Colorway: ${item.colorwayName}${item.colorCode ? ` (${item.colorCode})` : ''}`
                          : item.colorwayId
                            ? `Colorway linked (${item.colorwayId.slice(0, 8)}...)`
                            : 'Line-level only'}
                      </span>
                    </div>
                    <button className="button" onClick={() => flagBarcode(item.id, item.barcodeValue)} type="button">
                      Flag mismatch
                    </button>
                  </div>
                ))
              ) : (
                <p>No barcodes associated yet.</p>
              )}
            </div>
          </article>

          {data.canAdminEdit ? (
            <article className="soft-panel">
              <h2>Admin catalog controls</h2>
              {adminStatus ? <p>{adminStatus}</p> : null}
              <div className="stack-form">
                <label>Manufacturer<input onChange={(event) => setLineDraft((current) => ({ ...current, manufacturerName: event.target.value }))} type="text" value={lineDraft.manufacturerName} /></label>
                <label>Line name<input onChange={(event) => setLineDraft((current) => ({ ...current, name: event.target.value }))} type="text" value={lineDraft.name} /></label>
                <label>Weight class<input onChange={(event) => setLineDraft((current) => ({ ...current, weightClass: event.target.value }))} type="text" value={lineDraft.weightClass} /></label>
                <label>Fiber content<input onChange={(event) => setLineDraft((current) => ({ ...current, fiberContent: event.target.value }))} type="text" value={lineDraft.fiberContent} /></label>
                <label>Yardage meters<input onChange={(event) => setLineDraft((current) => ({ ...current, yardageMeters: event.target.value }))} type="number" value={lineDraft.yardageMeters} /></label>
                <label>Needle / Hook range<input onChange={(event) => setLineDraft((current) => ({ ...current, needleOrHookRange: event.target.value }))} type="text" value={lineDraft.needleOrHookRange} /></label>
                <label>Product URL<input onChange={(event) => setLineDraft((current) => ({ ...current, productUrl: event.target.value }))} type="text" value={lineDraft.productUrl} /></label>
                <button className="button button-primary" onClick={() => void saveAdminLine()} type="button">Save line</button>
              </div>
              <h3>Colorways</h3>
              <div className="catalog-sublist">
                {data.colorways.map((item) => {
                  const draft = colorwayDrafts[item.id] ?? { name: item.name, colorCode: item.colorCode ?? '', hexReference: item.hexReference ?? '' }
                  return (
                    <div className="catalog-subrow" key={item.id}>
                      <div className="stack-form">
                        <input onChange={(event) => setColorwayDrafts((current) => ({ ...current, [item.id]: { ...draft, name: event.target.value } }))} type="text" value={draft.name} />
                        <input onChange={(event) => setColorwayDrafts((current) => ({ ...current, [item.id]: { ...draft, colorCode: event.target.value } }))} placeholder="Color code" type="text" value={draft.colorCode} />
                        <input onChange={(event) => setColorwayDrafts((current) => ({ ...current, [item.id]: { ...draft, hexReference: event.target.value } }))} placeholder="Hex" type="text" value={draft.hexReference} />
                      </div>
                      <div className="hero-actions">
                        <button className="button" onClick={() => void saveAdminColorway(item.id)} type="button">Save</button>
                        <button className="button" onClick={() => void deleteAdminColorway(item.id)} type="button">Delete</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <h3>Barcodes</h3>
              <div className="catalog-sublist">
                {data.barcodes.map((item) => {
                  const draft = barcodeDrafts[item.id] ?? { barcodeValue: item.barcodeValue, colorwayId: item.colorwayId ?? '' }
                  return (
                    <div className="catalog-subrow" key={item.id}>
                      <div className="stack-form">
                        <input onChange={(event) => setBarcodeDrafts((current) => ({ ...current, [item.id]: { ...draft, barcodeValue: event.target.value } }))} type="text" value={draft.barcodeValue} />
                        <select onChange={(event) => setBarcodeDrafts((current) => ({ ...current, [item.id]: { ...draft, colorwayId: event.target.value } }))} value={draft.colorwayId}>
                          <option value="">Line-level only</option>
                          {data.colorways.map((colorway) => <option key={colorway.id} value={colorway.id}>{colorway.name}</option>)}
                        </select>
                      </div>
                      <div className="hero-actions">
                        <button className="button" onClick={() => void saveAdminBarcode(item.id)} type="button">Save</button>
                        <button className="button" onClick={() => void deleteAdminBarcode(item.id)} type="button">Delete</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <h3>Danger zone</h3>
              <div className="hero-actions">
                <button className="button" onClick={() => void deleteAdminLine()} type="button">Delete line</button>
                <button className="button" onClick={() => void deleteAdminManufacturer()} type="button">Delete manufacturer</button>
              </div>
            </article>
          ) : null}

          <CommentThread entityId={lineId} entityType="yarn_line" />
        </>
      ) : null}

      {editingTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="community-modal" role="dialog" aria-modal="true" aria-label="Edit field community suggestions">
            <div className="community-modal-head">
              <h3>{editingTarget.label}</h3>
              <button aria-label="Close" className="icon-button" onClick={closeModal} type="button">
                <X size={14} />
              </button>
            </div>

            {editingTarget.entityType === 'colorway' && editingTarget.fieldKey !== 'colorway_add' ? (
              <label>
                Edit field
                <select
                  onChange={(event) => void changeColorwayModalField(event.target.value as 'name' | 'colorCode' | 'hexReference')}
                  value={editingTarget.fieldKey}
                >
                  {colorwayFieldOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <form className="stack-form" onSubmit={submitCorrection}>
              {editingTarget.fieldKey === 'colorway_add' ? (
                <>
                  <label>
                    Colorway name
                    <input
                      onChange={(event) =>
                        setColorwayAddDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      type="text"
                      value={colorwayAddDraft.name}
                    />
                  </label>
                  <label>
                    Color code (optional)
                    <input
                      onChange={(event) =>
                        setColorwayAddDraft((current) => ({
                          ...current,
                          colorCode: event.target.value,
                        }))
                      }
                      type="text"
                      value={colorwayAddDraft.colorCode}
                    />
                  </label>
                  <label>
                    Hex reference (optional)
                    <input
                      onChange={(event) =>
                        setColorwayAddDraft((current) => ({
                          ...current,
                          hexReference: event.target.value,
                        }))
                      }
                      type="text"
                      value={colorwayAddDraft.hexReference}
                    />
                  </label>
                </>
              ) : (
                <label>
                  Suggest a new value
                  <input onChange={(event) => setProposedValue(event.target.value)} type="text" value={proposedValue} />
                </label>
              )}
              <label>
                Notes (optional)
                <input onChange={(event) => setProposedNotes(event.target.value)} type="text" value={proposedNotes} />
              </label>
              <button className="button button-primary" type="submit">
                Submit suggestion
              </button>
            </form>

            <div className="catalog-sublist">
              {modalClaimsLoading ? <p>Loading suggestions...</p> : null}
              {!modalClaimsLoading && !modalClaims.length ? <p>No suggestions yet for this field.</p> : null}
              {modalClaims.map((claim) => (
                <div className="catalog-subrow" key={claim.id}>
                  <div>
                    <strong>{displayClaimValue(claim)}</strong>
                    <span>
                      by {claim.createdByName} · {claim.status}
                      {claim.notes ? ` · ${claim.notes}` : ''}
                    </span>
                  </div>
                  <div className="claim-vote-actions">
                    <button className="button" onClick={() => voteOnClaim(claim.id, 'agree')} type="button">
                      Agree ({claim.agreeCount})
                    </button>
                    <button className="button" onClick={() => voteOnClaim(claim.id, 'disagree')} type="button">
                      Disagree ({claim.disagreeCount})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

async function loadLineDetail(
  lineId: string,
  setData: (value: LineDetailResponse | null) => void,
  setLoading: (value: boolean) => void,
  setError: (value: string | null) => void,
) {
  setLoading(true)
  setError(null)
  const response = await fetch(`/api/catalog/${lineId}`)
  if (!response.ok) {
    const payload = (await response.json()) as { message?: string }
    setError(payload.message ?? 'Could not load catalog line.')
    setData(null)
    setLoading(false)
    return
  }

  setData((await response.json()) as LineDetailResponse)
  setLoading(false)
}

async function loadClaims(
  lineId: string,
  setClaimsData: (value: ClaimsResponse | null) => void,
) {
  const response = await fetch(`/api/community/claims?entityType=yarn_line&entityId=${encodeURIComponent(lineId)}`)
  if (response.ok) {
    setClaimsData((await response.json()) as ClaimsResponse)
  } else {
    setClaimsData({ claims: [] })
  }
}

async function loadModalClaims(
  entityType: 'yarn_line' | 'colorway',
  entityId: string,
  fieldKey: string,
  setModalClaims: (value: Claim[]) => void,
  setModalClaimsLoading: (value: boolean) => void,
) {
  setModalClaimsLoading(true)
  const response = await fetch(
    `/api/community/claims?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}&fieldKey=${encodeURIComponent(fieldKey)}`,
  )
  if (response.ok) {
    const payload = (await response.json()) as ClaimsResponse
    setModalClaims(payload.claims)
  } else {
    setModalClaims([])
  }
  setModalClaimsLoading(false)
}

function displayClaimValue(claim: Claim) {
  if (claim.fieldKey === 'colorway_add' && claim.proposedValue) {
    try {
      const parsed = JSON.parse(claim.proposedValue) as { name?: string; colorCode?: string; hexReference?: string }
      const name = parsed.name?.trim() || 'Unnamed colorway'
      const code = parsed.colorCode?.trim() || ''
      const hex = parsed.hexReference?.trim() || ''
      return [name, code, hex].filter(Boolean).join(' · ')
    } catch {
      return claim.proposedValue
    }
  }

  return claim.proposedValue ?? 'N/A'
}
