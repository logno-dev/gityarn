import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, ExternalLink, ImagePlus, Save, ShieldCheck, Trash2, Users, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/admin')({ component: AdminPage })

type AdminPayload = {
  stats: {
    users: number
    admins: number
    openClaims: number
    openFlags: number
    inventoryEntries: number
  }
  users: Array<{
    id: string
    displayName: string
    email: string
    role: 'member' | 'admin'
    createdAt: number
  }>
  openClaims: Array<{
    id: string
    entityType: string
    fieldKey: string | null
    proposedValue: string | null
    createdByName: string
    agreeCount: number
    disagreeCount: number
  }>
  openFlags: Array<{
    id: string
    entityType: string
    reason: string
    details: string | null
    createdByName: string
  }>
  recentPublicContent: {
    patterns: Array<{
      id: string
      title: string
      ownerDisplayName: string
      isPublic: boolean
      moderationStatus: string
      updatedAt: number
    }>
    creations: Array<{
      id: string
      title: string
      ownerDisplayName: string
      isPublic: boolean
      moderationStatus: string
      updatedAt: number
    }>
    posts: Array<{
      id: string
      title: string | null
      ownerDisplayName: string
      isPublic: boolean
      moderationStatus: string
      updatedAt: number
    }>
  }
  carouselItems: Array<{
    id: string
    altText: string | null
    linkUrl: string | null
    sortOrder: number
    isActive: boolean
    updatedAt: number
    imageSrc: string
  }>
}

function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [data, setData] = useState<AdminPayload | null>(null)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, 'member' | 'admin'>>({})
  const [carouselDrafts, setCarouselDrafts] = useState<Record<string, {
    altText: string
    linkUrl: string
    sortOrder: number
    isActive: boolean
  }>>({})
  const [newCarouselImage, setNewCarouselImage] = useState<File | null>(null)
  const [newCarouselAltText, setNewCarouselAltText] = useState('')
  const [newCarouselLinkUrl, setNewCarouselLinkUrl] = useState('')
  const [newCarouselSortOrder, setNewCarouselSortOrder] = useState(0)
  const [newCarouselActive, setNewCarouselActive] = useState(true)
  const [addingCarousel, setAddingCarousel] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    const response = await fetch('/api/admin/overview')
    const payload = (await response.json()) as AdminPayload & { message?: string }
    if (!response.ok) {
      setError(payload.message ?? 'Could not load admin panel.')
      setLoading(false)
      return
    }

    setData(payload)
    setRoleDrafts(Object.fromEntries(payload.users.map((user) => [user.id, user.role])))
    setCarouselDrafts(
      Object.fromEntries(
        payload.carouselItems.map((item) => [
          item.id,
          {
            altText: item.altText ?? '',
            linkUrl: item.linkUrl ?? '',
            sortOrder: item.sortOrder,
            isActive: item.isActive,
          },
        ]),
      ),
    )
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const hasRoleChanges = useMemo(
    () => Boolean(data?.users.some((user) => roleDrafts[user.id] && roleDrafts[user.id] !== user.role)),
    [data, roleDrafts],
  )

  const saveRole = async (userId: string) => {
    const role = roleDrafts[userId]
    if (!role) {
      return
    }
    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Role updated.' : 'Could not update role.'))
    if (response.ok) {
      await load()
    }
  }

  const addCarouselItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newCarouselImage) {
      setStatus('Choose an image before adding a carousel item.')
      return
    }

    const formData = new FormData()
    formData.append('image', newCarouselImage)
    formData.append('altText', newCarouselAltText)
    formData.append('linkUrl', newCarouselLinkUrl)
    formData.append('sortOrder', String(newCarouselSortOrder))
    formData.append('isActive', newCarouselActive ? '1' : '0')

    setAddingCarousel(true)
    const response = await fetch('/api/admin/carousel', {
      method: 'POST',
      body: formData,
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Carousel item added.' : 'Could not add carousel item.'))
    setAddingCarousel(false)
    if (response.ok) {
      setNewCarouselImage(null)
      setNewCarouselAltText('')
      setNewCarouselLinkUrl('')
      setNewCarouselSortOrder(0)
      setNewCarouselActive(true)
      await load()
    }
  }

  const saveCarouselItem = async (itemId: string) => {
    const draft = carouselDrafts[itemId]
    if (!draft) {
      return
    }
    const response = await fetch('/api/admin/carousel', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: itemId,
        altText: draft.altText,
        linkUrl: draft.linkUrl,
        sortOrder: draft.sortOrder,
        isActive: draft.isActive,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Carousel item updated.' : 'Could not update carousel item.'))
    if (response.ok) {
      await load()
    }
  }

  const deleteCarouselItem = async (itemId: string) => {
    const response = await fetch('/api/admin/carousel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Carousel item removed.' : 'Could not remove carousel item.'))
    if (response.ok) {
      await load()
    }
  }

  const removeContent = async (entityType: 'pattern' | 'creation' | 'post', entityId: string) => {
    const reason = window.prompt('Optional removal reason shown to the owner:') ?? ''
    const response = await fetch('/api/admin/moderation/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, reason: reason.trim() || null }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Content removed.' : 'Could not remove content.'))
    if (response.ok) {
      await load()
    }
  }

  return (
    <section className="page-stack">
      {loading ? <p>Loading admin data...</p> : null}
      {error ? <p>{error}</p> : null}
      {status ? <p>{status}</p> : null}

      {!loading && !error && data ? (
        <>
          <div className="catalog-stat-grid">
            <article className="catalog-stat">
              <strong>{data.stats.users}</strong>
              <span>Total users</span>
            </article>
            <article className="catalog-stat">
              <strong>{data.stats.admins}</strong>
              <span>Admins</span>
            </article>
            <article className="catalog-stat">
              <strong>{data.stats.openClaims}</strong>
              <span>Open claims</span>
            </article>
            <article className="catalog-stat">
              <strong>{data.stats.openFlags}</strong>
              <span>Open flags</span>
            </article>
          </div>

          <section className="catalog-detail-grid">
            <article className="soft-panel">
              <h2>
                <Users size={16} /> User roles
              </h2>
              {data.users.map((user) => (
                <div className="admin-user-row" key={user.id}>
                  <div>
                    <strong>{user.displayName}</strong>
                    <span>{user.email}</span>
                  </div>
                  <select
                    onChange={(event) =>
                      setRoleDrafts((current) => ({
                        ...current,
                        [user.id]: event.target.value as 'member' | 'admin',
                      }))
                    }
                    value={roleDrafts[user.id] ?? user.role}
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                  <button className="button" onClick={() => void saveRole(user.id)} type="button">
                    <Save size={14} /> Save
                  </button>
                </div>
              ))}
              {!hasRoleChanges ? <p>No pending role changes.</p> : null}
            </article>

            <article className="soft-panel">
              <h2>
                <ShieldCheck size={16} /> Open claims
              </h2>
              {data.openClaims.length ? (
                <div className="catalog-sublist">
                  {data.openClaims.map((claim) => (
                    <div className="catalog-subrow" key={claim.id}>
                      <div>
                        <strong>{claim.entityType} · {claim.fieldKey ?? 'general'}</strong>
                        <span>{claim.createdByName} · agree {claim.agreeCount} / disagree {claim.disagreeCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No open claims.</p>
              )}
            </article>
          </section>

          <article className="soft-panel">
            <h2>
              <AlertTriangle size={16} /> Open flags
            </h2>
            {data.openFlags.length ? (
              <div className="catalog-sublist">
                {data.openFlags.map((flag) => (
                  <div className="catalog-subrow" key={flag.id}>
                    <div>
                      <strong>{flag.entityType} · {flag.reason}</strong>
                      <span>{flag.createdByName}{flag.details ? ` · ${flag.details}` : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No open flags.</p>
            )}
          </article>

          <article className="soft-panel">
            <h2>
              <ImagePlus size={16} /> Landing carousel
            </h2>
            <form className="stack-form" onSubmit={addCarouselItem}>
              <label>
                Image
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => setNewCarouselImage(event.target.files?.[0] ?? null)}
                  required
                  type="file"
                />
              </label>
              <label>
                Alt text (optional)
                <input
                  onChange={(event) => setNewCarouselAltText(event.target.value)}
                  placeholder="Describe the image for accessibility"
                  type="text"
                  value={newCarouselAltText}
                />
              </label>
              <label>
                Link URL (optional)
                <input
                  onChange={(event) => setNewCarouselLinkUrl(event.target.value)}
                  placeholder="https://example.com or /catalog"
                  type="text"
                  value={newCarouselLinkUrl}
                />
              </label>
              <label>
                Sort order
                <input
                  onChange={(event) => setNewCarouselSortOrder(Number.parseInt(event.target.value, 10) || 0)}
                  type="number"
                  value={newCarouselSortOrder}
                />
              </label>
              <label className="inventory-toggle-label">
                <input
                  checked={newCarouselActive}
                  onChange={(event) => setNewCarouselActive(event.target.checked)}
                  type="checkbox"
                />
                Active on landing page
              </label>
              <button className="button button-primary" disabled={addingCarousel} type="submit">
                <ImagePlus size={14} /> {addingCarousel ? 'Adding...' : 'Add carousel item'}
              </button>
            </form>

            <div className="catalog-sublist">
              {data.carouselItems.map((item) => {
                const draft = carouselDrafts[item.id]
                return (
                  <div className="admin-carousel-row" key={item.id}>
                    <img alt={draft?.altText || item.altText || 'Carousel image'} className="admin-carousel-thumb" src={item.imageSrc} />
                    <label>
                      Alt text
                      <input
                        onChange={(event) =>
                          setCarouselDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? { altText: '', linkUrl: '', sortOrder: 0, isActive: true }),
                              altText: event.target.value,
                            },
                          }))
                        }
                        type="text"
                        value={draft?.altText ?? ''}
                      />
                    </label>
                    <label>
                      Link URL
                      <input
                        onChange={(event) =>
                          setCarouselDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? { altText: '', linkUrl: '', sortOrder: 0, isActive: true }),
                              linkUrl: event.target.value,
                            },
                          }))
                        }
                        placeholder="https://example.com or /catalog"
                        type="text"
                        value={draft?.linkUrl ?? ''}
                      />
                    </label>
                    <label>
                      Sort order
                      <input
                        onChange={(event) =>
                          setCarouselDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? { altText: '', linkUrl: '', sortOrder: 0, isActive: true }),
                              sortOrder: Number.parseInt(event.target.value, 10) || 0,
                            },
                          }))
                        }
                        type="number"
                        value={draft?.sortOrder ?? 0}
                      />
                    </label>
                    <label className="inventory-toggle-label">
                      <input
                        checked={Boolean(draft?.isActive)}
                        onChange={(event) =>
                          setCarouselDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? { altText: '', linkUrl: '', sortOrder: 0, isActive: true }),
                              isActive: event.target.checked,
                            },
                          }))
                        }
                        type="checkbox"
                      />
                      Active
                    </label>
                    <div className="hero-actions">
                      {draft?.linkUrl ? (
                        <a className="button" href={draft.linkUrl} rel="noreferrer" target="_blank">
                          <ExternalLink size={14} /> Open
                        </a>
                      ) : null}
                      <button className="button" onClick={() => void saveCarouselItem(item.id)} type="button">
                        <Save size={14} /> Save
                      </button>
                      <button className="button" onClick={() => void deleteCarouselItem(item.id)} type="button">
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                    <span className="admin-carousel-updated">Updated {new Date(item.updatedAt).toLocaleString()}</span>
                  </div>
                )
              })}
              {!data.carouselItems.length ? <p>No carousel items yet.</p> : null}
            </div>
          </article>

          <article className="soft-panel">
            <h2>
              <XCircle size={16} /> Moderate public content
            </h2>
            <div className="catalog-sublist">
              {data.recentPublicContent.patterns.map((item) => (
                <div className="catalog-subrow" key={`pattern-${item.id}`}>
                  <div>
                    <strong>Pattern · {item.title}</strong>
                    <span>{item.ownerDisplayName} · {new Date(item.updatedAt).toLocaleString()}</span>
                  </div>
                  <button className="button" onClick={() => void removeContent('pattern', item.id)} type="button">
                    Remove
                  </button>
                </div>
              ))}
              {data.recentPublicContent.creations.map((item) => (
                <div className="catalog-subrow" key={`creation-${item.id}`}>
                  <div>
                    <strong>Creation · {item.title}</strong>
                    <span>{item.ownerDisplayName} · {new Date(item.updatedAt).toLocaleString()}</span>
                  </div>
                  <button className="button" onClick={() => void removeContent('creation', item.id)} type="button">
                    Remove
                  </button>
                </div>
              ))}
              {data.recentPublicContent.posts.map((item) => (
                <div className="catalog-subrow" key={`post-${item.id}`}>
                  <div>
                    <strong>Post · {item.title || 'Untitled'}</strong>
                    <span>{item.ownerDisplayName} · {new Date(item.updatedAt).toLocaleString()}</span>
                  </div>
                  <button className="button" onClick={() => void removeContent('post', item.id)} type="button">
                    Remove
                  </button>
                </div>
              ))}
              {!data.recentPublicContent.patterns.length && !data.recentPublicContent.creations.length && !data.recentPublicContent.posts.length ? (
                <p>No public content to moderate.</p>
              ) : null}
            </div>
          </article>
        </>
      ) : null}
    </section>
  )
}
