import { createFileRoute } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CommentThread } from '#/components/comment-thread'

export const Route = createFileRoute('/pattern/$patternId')({ component: PatternDetailPage })

type PatternPayload = {
  id: string
  userId: string
  ownerDisplayName: string
  title: string
  description: string | null
  sourceUrl: string | null
  difficulty: string | null
  notes: string | null
  hasPdf: boolean
  coverSrc: string | null
  heartCount: number
  viewerHasHeart: boolean
  commentCount: number
  inLibrary: boolean
}

function PatternDetailPage() {
  const { patternId } = Route.useParams()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [data, setData] = useState<PatternPayload | null>(null)

  const load = async () => {
    setLoading(true)
    const response = await fetch(`/api/patterns/${patternId}`)
    const payload = (await response.json()) as PatternPayload & { message?: string }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not load pattern.')
      setLoading(false)
      return
    }
    setData(payload)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [patternId])

  const toggleHeart = async () => {
    if (!data) return
    const response = await fetch(`/api/patterns/${patternId}/hearts`, { method: 'POST' })
    const payload = (await response.json()) as { message?: string; heartCount?: number; viewerHasHeart?: boolean }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not update heart.')
      return
    }
    setData({ ...data, heartCount: payload.heartCount ?? data.heartCount, viewerHasHeart: payload.viewerHasHeart ?? data.viewerHasHeart })
  }

  const addToLibrary = async () => {
    const response = await fetch(`/api/patterns/${patternId}/library`, { method: 'POST' })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Updated library.' : 'Could not update library.'))
    if (response.ok && data) setData({ ...data, inLibrary: true })
  }

  return (
    <section className="page-stack post-detail-page">
      {status ? <p>{status}</p> : null}
      {loading ? <p>Loading pattern...</p> : null}
      {data ? (
        <article className="soft-panel hero-card">
          <h1>{data.title}</h1>
          <p>{data.ownerDisplayName} · {data.difficulty ?? 'No difficulty'}</p>
          {data.coverSrc ? <img alt={data.title} className="discover-preview" src={data.coverSrc} /> : null}
          {data.description ? <p>{data.description}</p> : null}
          {data.notes ? <p>{data.notes}</p> : null}
          <div className="hero-actions">
            {data.hasPdf ? <a className="button" href={`/api/patterns/${data.id}/file`}><span>Open pattern PDF</span></a> : null}
            <button className="button" disabled={data.inLibrary} onClick={() => void addToLibrary()} type="button">
              {data.inLibrary ? 'Already in inventory' : 'Add to inventory'}
            </button>
          </div>
          <div className="hero-actions">
            <button className="button" onClick={() => void toggleHeart()} type="button">
              <Heart fill={data.viewerHasHeart ? 'currentColor' : 'none'} size={14} /> {data.heartCount}
            </button>
            <span>{data.commentCount} comments</span>
          </div>
          <CommentThread entityId={data.id} entityType="pattern" />
        </article>
      ) : null}
    </section>
  )
}
