import { createFileRoute } from '@tanstack/react-router'
import { Download, ImagePlus, Send, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/dashboard')({ component: DiscoverPage })

type FeedItem = {
  id: string
  kind: 'pattern' | 'creation' | 'post'
  entityId: string
  title: string
  body: string | null
  ownerDisplayName: string
  previewImage: string | null
  downloadUrl: string | null
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
  const [items, setItems] = useState<FeedItem[]>([])
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [status, setStatus] = useState('')
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [postBody, setPostBody] = useState('')
  const [postImages, setPostImages] = useState<File[]>([])
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

  return (
    <section className="page-stack">
      <header className="page-header">
        <h1>Discover</h1>
        <p>Newest public patterns, creations, and posts from the community, in one chronological feed.</p>
      </header>

      <article className="soft-panel discover-compose">
        <h2>
          <Sparkles size={16} /> Share a post
        </h2>
        <form className="stack-form" onSubmit={publishPost}>
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
            <div className="discover-card-head">
              <strong>{item.title}</strong>
              <span>
                {item.kind} · {item.ownerDisplayName} · {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
            {item.previewImage ? <img alt={item.title} className="discover-preview" src={item.previewImage} /> : null}
            {item.body ? <p>{item.body}</p> : null}
            {item.downloadUrl ? (
              <a className="button" href={item.downloadUrl}>
                <Download size={14} /> Download
              </a>
            ) : null}
          </article>
        ))}
      </div>

      <div ref={sentinelRef} />
      {loadingMore ? <p>Loading more...</p> : null}
      {!hasNextPage && items.length ? <p>You reached the end of the feed.</p> : null}
    </section>
  )
}
