import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CommentThread } from '#/components/comment-thread'

export const Route = createFileRoute('/creation/$creationId')({ component: CreationDetailPage })

type CreationPayload = {
  id: string
  userId: string
  ownerDisplayName: string
  name: string
  status: string
  notes: string | null
  isPublic: boolean
  moderationStatus: string
  moderationReason: string | null
  updatedAt: number
  images: Array<{ id: string; src: string }>
  yarn: Array<{
    inventoryId: string
    lineId: string | null
    lineName: string | null
    manufacturerName: string | null
    colorwayName: string | null
    colorCode: string | null
    skeinsUsed: number
  }>
  hooks: Array<{
    hookId: string
    sizeLabel: string
    metricSizeMm: string | null
    material: string | null
  }>
  pattern: {
    id: string
    title: string
    isPublic: boolean
    hasPdf: boolean
  } | null
  heartCount: number
  viewerHasHeart: boolean
  commentCount: number
}

function CreationDetailPage() {
  const { creationId } = Route.useParams()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [data, setData] = useState<CreationPayload | null>(null)
  const [imageIndex, setImageIndex] = useState(0)

  const load = async () => {
    setLoading(true)
    const response = await fetch(`/api/creations/${creationId}`)
    const payload = (await response.json()) as CreationPayload & { message?: string }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not load creation.')
      setLoading(false)
      return
    }
    setData(payload)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [creationId])

  useEffect(() => {
    setImageIndex(0)
  }, [creationId, data?.images.length])

  const toggleHeart = async () => {
    if (!data) return
    const response = await fetch(`/api/creations/${creationId}/hearts`, { method: 'POST' })
    const payload = (await response.json()) as { heartCount?: number; viewerHasHeart?: boolean; message?: string }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not update heart.')
      return
    }
    setData({
      ...data,
      heartCount: payload.heartCount ?? data.heartCount,
      viewerHasHeart: payload.viewerHasHeart ?? data.viewerHasHeart,
    })
  }

  return (
    <section className="page-stack post-detail-page">
      {status ? <p>{status}</p> : null}
      {loading ? <p>Loading creation...</p> : null}
      {data ? (
        <article className="soft-panel hero-card">
          <h1>{data.name}</h1>
          <p>{data.ownerDisplayName} · {data.status} · {new Date(data.updatedAt).toLocaleString()}</p>
          {data.pattern ? (
            <p>
              Pattern: {data.pattern.title}{' '}
              {data.pattern.isPublic && data.pattern.hasPdf ? (
                <a className="button" href={`/api/patterns/${data.pattern.id}/file`}>
                  Open pattern
                </a>
              ) : null}
            </p>
          ) : null}
          {data.notes ? <p>{data.notes}</p> : null}
          {data.yarn.length ? (
            <div className="catalog-sublist">
              <strong>Yarn used</strong>
              {data.yarn.map((item) => (
                <span key={item.inventoryId}>
                  {item.lineId ? (
                    <Link params={{ lineId: item.lineId }} to="/catalog/$lineId">
                      {(item.manufacturerName ?? 'Unknown')} · {(item.lineName ?? 'Unknown')}
                    </Link>
                  ) : (
                    <>{(item.manufacturerName ?? 'Unknown')} · {(item.lineName ?? 'Unknown')}</>
                  )}
                  {item.colorwayName ? ` · ${item.colorwayName}` : ''}
                  {item.colorCode ? ` (${item.colorCode})` : ''}
                  {` · ${item.skeinsUsed} skein(s)`}
                </span>
              ))}
            </div>
          ) : null}
          {data.hooks.length ? (
            <div className="catalog-sublist">
              <strong>Hooks used</strong>
              {data.hooks.map((item) => (
                <span key={item.hookId}>
                  {item.sizeLabel}
                  {item.metricSizeMm ? ` (${item.metricSizeMm}mm)` : ''}
                  {item.material ? ` · ${item.material}` : ''}
                </span>
              ))}
            </div>
          ) : null}
          {data.images.length ? (
            <div className="creation-gallery-shell">
              <img alt={data.name} className="discover-preview" src={data.images[imageIndex]?.src} />
              {data.images.length > 1 ? (
                <>
                  <button
                    className="creation-gallery-arrow left"
                    onClick={() => setImageIndex((current) => (current - 1 + data.images.length) % data.images.length)}
                    type="button"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    className="creation-gallery-arrow right"
                    onClick={() => setImageIndex((current) => (current + 1) % data.images.length)}
                    type="button"
                  >
                    <ChevronRight size={15} />
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          <div className="hero-actions">
            <button className="button" onClick={() => void toggleHeart()} type="button">
              <Heart fill={data.viewerHasHeart ? 'currentColor' : 'none'} size={14} /> {data.heartCount}
            </button>
            <span>{data.commentCount} comments</span>
          </div>
          <CommentThread entityId={data.id} entityType="creation" />
        </article>
      ) : null}
    </section>
  )
}
