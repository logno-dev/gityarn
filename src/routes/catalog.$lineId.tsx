import { createFileRoute } from '@tanstack/react-router'
import { Link2, Pencil, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { CommentThread } from '#/components/comment-thread'

export const Route = createFileRoute('/catalog/$lineId')({ component: CatalogLinePage })

type LineDetailResponse = {
  line: {
    id: string
    name: string
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

  useEffect(() => {
    void loadLineDetail(lineId, setData, setLoading, setError)
  }, [lineId])

  useEffect(() => {
    void loadClaims(lineId, setClaimsData)
  }, [lineId])

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
          <header className="page-header">
            <div className="headline-edit-row">
              <h1>{getDisplayValue('name', data.line.name)}</h1>
              <button className="icon-button" onClick={() => void openLineFieldModal('name')} type="button">
                <Pencil size={14} />
              </button>
            </div>
            <p>
              {data.line.manufacturerName} · {getDisplayValue('weightClass', data.line.weightClass)} ·{' '}
              {getDisplayValue('fiberContent', data.line.fiberContent)}
            </p>
            {getDisplayValue('productUrl', data.line.productUrl) !== 'Unknown' ? (
              <div className="link-edit-row">
                <a href={getDisplayValue('productUrl', data.line.productUrl)} rel="noreferrer" target="_blank">
                  <Link2 size={14} /> Open manufacturer page
                </a>
                <button className="icon-button" onClick={() => void openLineFieldModal('productUrl')} type="button">
                  <Pencil size={14} />
                </button>
              </div>
            ) : null}
          </header>

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
