import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Download, Heart, ImagePlus, MessageCircle, Send, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/dashboard')({ component: DiscoverPage })

type FeedItem = {
  id: string
  kind: 'pattern' | 'creation' | 'post'
  entityId: string
  title: string | null
  body: string | null
  ownerId: string
  ownerDisplayName: string
  previewImage: string | null
  downloadUrl: string | null
  heartCount?: number
  viewerHasHeart?: boolean
  commentCount?: number
  createdAt: number
}

type FeedPayload = {
  items: FeedItem[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    hasNextPage: boolean
  }
}

function DiscoverPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<FeedItem[]>([])
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [status, setStatus] = useState('')
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [postBody, setPostBody] = useState('')
  const [postImages, setPostImages] = useState<File[]>([])
  const [authUser, setAuthUser] = useState<{ id: string; role: 'member' | 'admin' } | null>(null)
  const [pendingRemovalItem, setPendingRemovalItem] = useState<FeedItem | null>(null)
  const [removalReason, setRemovalReason] = useState('')
  const [removing, setRemoving] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadFeed = async (requestedPage: number, append: boolean) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    const response = await fetch(`/api/discover/feed?page=${requestedPage}&pageSize=20`)
    const payload = (await response.json()) as FeedPayload & { message?: string }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not load discover feed.')
      setLoading(false)
      setLoadingMore(false)
      return
    }

    setItems((current) => (append ? [...current, ...payload.items] : payload.items))
    setHasNextPage(payload.pagination.hasNextPage)
    setPage(payload.pagination.page)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    void loadFeed(1, false)
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((payload: { user: { id: string; role: 'member' | 'admin' } | null }) => setAuthUser(payload.user))
      .catch(() => setAuthUser(null))
  }, [])

  useEffect(() => {
    if (!sentinelRef.current) {
      return
    }

    const node = sentinelRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting || loading || loadingMore || !hasNextPage) {
          return
        }
        void loadFeed(page + 1, true)
      },
      { rootMargin: '380px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [page, hasNextPage, loading, loadingMore])

  const publishPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = postBody.trim()
    if (!body) {
      setStatus('Post body is required.')
      return
    }

    const form = new FormData()
    form.append('body', body)
    postImages.forEach((file) => form.append('files', file))

    const response = await fetch('/api/posts', {
      method: 'POST',
      body: form,
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Post published.' : 'Could not publish post.'))
    if (response.ok) {
      setPostBody('')
      setPostImages([])
      setComposerExpanded(false)
      await loadFeed(1, false)
    }
  }

  const removeAsAdmin = async (item: FeedItem, reason: string) => {
    setRemoving(true)
    const response = await fetch('/api/admin/moderation/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: item.kind,
        entityId: item.entityId,
        reason: reason.trim() || null,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Content removed.' : 'Could not remove content.'))
    setRemoving(false)
    if (response.ok) {
      setPendingRemovalItem(null)
      setRemovalReason('')
      await loadFeed(1, false)
    }
  }

  const togglePostHeart = async (item: FeedItem) => {
    if (item.kind !== 'post') {
      return
    }
    const response = await fetch(`/api/posts/${item.entityId}/hearts`, {
      method: 'POST',
    })
    const payload = (await response.json()) as { message?: string; heartCount?: number; viewerHasHeart?: boolean }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not update heart.')
      return
    }

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              heartCount: payload.heartCount ?? entry.heartCount ?? 0,
              viewerHasHeart: payload.viewerHasHeart ?? entry.viewerHasHeart ?? false,
            }
          : entry,
      ),
    )
  }

  return (
    <section className="page-stack">
      <article className="discover-compose">
        <form className={`stack-form ${composerExpanded ? 'expanded' : ''}`} onSubmit={publishPost}>
          {!composerExpanded ? (
            <input
              className="discover-quick-input"
              onFocus={() => setComposerExpanded(true)}
              onChange={(event) => setPostBody(event.target.value)}
              placeholder="Share something with the community..."
              type="text"
              value={postBody}
            />
          ) : (
            <>
              <label>
                Post body
                <textarea autoFocus onChange={(event) => setPostBody(event.target.value)} rows={4} value={postBody} />
              </label>
              <label>
                <ImagePlus size={14} /> Add images (optional)
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={(event) => setPostImages(Array.from(event.target.files ?? []))}
                  type="file"
                />
              </label>
              <div className="hero-actions">
                <button className="button button-primary" type="submit">
                  <Send size={14} /> Publish
                </button>
                <button
                  className="button"
                  onClick={() => {
                    setComposerExpanded(false)
                    setPostBody('')
                    setPostImages([])
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      </article>

      {status ? <p>{status}</p> : null}
      {loading ? <p>Loading discover feed...</p> : null}

      {!loading && !items.length ? <p>No public activity yet.</p> : null}

      <div className="discover-feed">
        {items.map((item) => (
          <article className="soft-panel discover-card" key={item.id}>
            {item.kind === 'post' ? (
              <Link className="post-author-dot" params={{ userId: item.ownerId }} to="/profile/$userId">
                <img
                  alt={item.ownerDisplayName}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                    const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
                    if (fallback) fallback.style.display = 'inline-flex'
                  }}
                  src={`/api/profiles/${item.ownerId}/avatar`}
                />
                <span className="post-author-dot-fallback">{item.ownerDisplayName.slice(0, 1).toUpperCase()}</span>
              </Link>
            ) : null}
            <div className="discover-card-head">
              {item.title ? <strong>{item.title}</strong> : null}
              <div className="discover-card-meta-row">
                <span>
                  <Link params={{ userId: item.ownerId }} to="/profile/$userId">
                    {item.ownerDisplayName}
                  </Link>{' '}
                  · {new Date(item.createdAt).toLocaleString()}
                </span>
                <span className="discover-card-kind">{item.kind}</span>
              </div>
            </div>
            {item.previewImage ? <img alt={item.title || 'Post image'} className="discover-preview" src={item.previewImage} /> : null}
            {item.body ? <p>{item.body}</p> : null}
            <div className="hero-actions">
              {item.downloadUrl ? (
                <a className="button" href={item.downloadUrl}>
                  <Download size={14} /> Download
                </a>
              ) : null}
              {item.kind === 'post' ? (
                <button className="button" onClick={() => void togglePostHeart(item)} type="button">
                  <Heart fill={item.viewerHasHeart ? 'currentColor' : 'none'} size={14} /> {item.heartCount ?? 0}
                </button>
              ) : null}
              {item.kind === 'post' ? (
                <button
                  className="button"
                  onClick={() => navigate({ to: '/post/$postId', params: { postId: item.entityId } })}
                  type="button"
                >
                  <MessageCircle size={14} /> {item.commentCount ?? 0}
                </button>
              ) : null}
              {authUser?.role === 'admin' ? (
                <button
                  className="button"
                  onClick={() => {
                    setPendingRemovalItem(item)
                    setRemovalReason('')
                  }}
                  type="button"
                >
                  <XCircle size={14} /> Remove
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div ref={sentinelRef} />
      {loadingMore ? <p>Loading more...</p> : null}
      {!hasNextPage && items.length ? <p>You reached the end of the feed.</p> : null}

      {pendingRemovalItem ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-label="Remove public content" aria-modal="true" className="community-modal" role="dialog">
            <div className="community-modal-head">
              <h3>
                Remove {pendingRemovalItem.kind}
                {pendingRemovalItem.title ? `: ${pendingRemovalItem.title}` : ''}
              </h3>
            </div>
            <div className="stack-form">
              <label>
                Reason (optional, visible to owner)
                <textarea
                  onChange={(event) => setRemovalReason(event.target.value)}
                  placeholder="Explain why this content was removed"
                  rows={4}
                  value={removalReason}
                />
              </label>
              <div className="hero-actions">
                <button
                  className="button button-primary"
                  disabled={removing}
                  onClick={() => void removeAsAdmin(pendingRemovalItem, removalReason)}
                  type="button"
                >
                  {removing ? 'Removing...' : 'Confirm remove'}
                </button>
                <button
                  className="button"
                  disabled={removing}
                  onClick={() => {
                    setPendingRemovalItem(null)
                    setRemovalReason('')
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  )
}
