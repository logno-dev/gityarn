import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CommentThread } from '#/components/comment-thread'

export const Route = createFileRoute('/post/$postId')({ component: PostDetailPage })

type PostPayload = {
  post: {
    id: string
    title: string | null
    body: string
    ownerDisplayName: string
    ownerId: string
    moderationStatus: string
    moderationReason: string | null
    updatedAt: number
    heartCount: number
    viewerHasHeart: boolean
    commentCount: number
    images: Array<{ id: string; mimeType: string | null; createdAt: number; src: string }>
  }
}

function PostDetailPage() {
  const { postId } = Route.useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [data, setData] = useState<PostPayload['post'] | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const response = await fetch(`/api/posts/${postId}`)
    const payload = (await response.json()) as PostPayload & { message?: string }
    if (!response.ok) {
      setError(payload.message ?? 'Could not load post.')
      setLoading(false)
      return
    }
    setData(payload.post)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [postId])

  const toggleHeart = async () => {
    const response = await fetch(`/api/posts/${postId}/hearts`, { method: 'POST' })
    const payload = (await response.json()) as { message?: string; heartCount?: number; viewerHasHeart?: boolean }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not update heart.')
      return
    }
    setData((current) =>
      current
        ? {
            ...current,
            heartCount: payload.heartCount ?? current.heartCount,
            viewerHasHeart: payload.viewerHasHeart ?? current.viewerHasHeart,
          }
        : current,
    )
  }

  return (
    <section className="page-stack page-narrow">
      <Link className="button" to="/dashboard">
        <ArrowLeft size={14} /> Back to Discover
      </Link>

      {loading ? <p>Loading post...</p> : null}
      {error ? <p>{error}</p> : null}
      {status ? <p>{status}</p> : null}

      {!loading && !error && data ? (
        <article className="soft-panel discover-card">
          <div className="discover-card-head">
            {data.title ? <strong>{data.title}</strong> : null}
            <span>
              <Link params={{ userId: data.ownerId }} to="/profile/$userId">
                {data.ownerDisplayName}
              </Link>{' '}
              · {new Date(data.updatedAt).toLocaleString()}
            </span>
          </div>
          {data.images.length ? (
            <div className="discover-image-stack">
              {data.images.map((image) => (
                <img alt={data.title || 'Post image'} className="discover-preview" key={image.id} src={image.src} />
              ))}
            </div>
          ) : null}
          <p>{data.body}</p>
          <div className="hero-actions">
            <button className="button" onClick={() => void toggleHeart()} type="button">
              <Heart fill={data.viewerHasHeart ? 'currentColor' : 'none'} size={14} /> {data.heartCount}
            </button>
            <span>{data.commentCount} comments</span>
          </div>
        </article>
      ) : null}

      {!loading && !error ? <CommentThread entityId={postId} entityType="post" /> : null}
    </section>
  )
}
