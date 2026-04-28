import { Link, createFileRoute } from '@tanstack/react-router'
import { Download, ExternalLink, MessageCircle, Newspaper, Palette, Scissors } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type ProfileTab = 'posts' | 'creations' | 'patterns' | 'comments'

export const Route = createFileRoute('/profile/$userId')({
  validateSearch: (search: Record<string, unknown>): { tab?: ProfileTab } => {
    const tab = typeof search.tab === 'string' ? search.tab : ''
    if (tab === 'posts' || tab === 'creations' || tab === 'patterns' || tab === 'comments') {
      return { tab }
    }
    return {}
  },
  component: ProfilePage,
})

type ProfilePayload = {
  profile: {
    id: string
    displayName: string
    bio: string | null
    avatarUpdatedAt: number | null
    websiteUrl: string | null
    instagramUrl: string | null
    etsyUrl: string | null
    ravelryUrl: string | null
    tiktokUrl: string | null
    youtubeUrl: string | null
    joinedAt: number
  }
  stats: {
    posts: number
    patterns: number
    creations: number
    comments: number
  }
  posts: Array<{ id: string; title: string | null; body: string; updatedAt: number }>
  patterns: Array<{ id: string; title: string; description: string | null; difficulty: string | null; hasPdf: boolean; updatedAt: number }>
  creations: Array<{ id: string; name: string; notes: string | null; status: string; updatedAt: number }>
  comments: Array<{ id: string; entityType: string; entityId: string; body: string; createdAt: number; targetPath: string | null }>
}

function ProfilePage() {
  const { userId } = Route.useParams()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ProfilePayload | null>(null)

  const activeTab = useMemo<ProfileTab>(() => {
    if (search.tab === 'creations' || search.tab === 'patterns' || search.tab === 'comments') {
      return search.tab
    }
    return 'posts'
  }, [search.tab])

  const setActiveTab = (tab: ProfileTab) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab,
      }),
      replace: true,
    })
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/profiles/${userId}`)
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }: { ok: boolean; payload: ProfilePayload & { message?: string } }) => {
        if (!ok) {
          setError(payload.message ?? 'Could not load profile.')
          setLoading(false)
          return
        }
        setData(payload)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load profile.')
        setLoading(false)
      })
  }, [userId])

  const avatarSrc = data?.profile.avatarUpdatedAt
    ? `/api/profiles/${data.profile.id}/avatar?v=${data.profile.avatarUpdatedAt}`
    : ''

  return (
    <section className="page-stack">
      {loading ? <p>Loading profile...</p> : null}
      {error ? <p>{error}</p> : null}

      {!loading && !error && data ? (
        <>
          <article className="soft-panel profile-hero">
            <div className="profile-hero-head">
              {avatarSrc ? <img alt={data.profile.displayName} className="avatar-preview" src={avatarSrc} /> : <div className="avatar-fallback">{data.profile.displayName.slice(0, 1).toUpperCase()}</div>}
              <div>
                <h2>{data.profile.displayName}</h2>
                <p>Joined {new Date(data.profile.joinedAt).toLocaleDateString()}</p>
              </div>
            </div>
            {data.profile.bio ? <p>{data.profile.bio}</p> : <p>No bio shared yet.</p>}
            <div className="hero-actions">
              {data.profile.websiteUrl ? (
                <a className="button" href={data.profile.websiteUrl} rel="noreferrer" target="_blank">
                  Website <ExternalLink size={14} />
                </a>
              ) : null}
              {data.profile.instagramUrl ? (
                <a className="button" href={data.profile.instagramUrl} rel="noreferrer" target="_blank">
                  Instagram <ExternalLink size={14} />
                </a>
              ) : null}
              {data.profile.etsyUrl ? (
                <a className="button" href={data.profile.etsyUrl} rel="noreferrer" target="_blank">
                  Etsy <ExternalLink size={14} />
                </a>
              ) : null}
              {data.profile.ravelryUrl ? (
                <a className="button" href={data.profile.ravelryUrl} rel="noreferrer" target="_blank">
                  Ravelry <ExternalLink size={14} />
                </a>
              ) : null}
              {data.profile.tiktokUrl ? (
                <a className="button" href={data.profile.tiktokUrl} rel="noreferrer" target="_blank">
                  TikTok <ExternalLink size={14} />
                </a>
              ) : null}
              {data.profile.youtubeUrl ? (
                <a className="button" href={data.profile.youtubeUrl} rel="noreferrer" target="_blank">
                  YouTube <ExternalLink size={14} />
                </a>
              ) : null}
            </div>
          </article>

          <article className="soft-panel">
            <div className="inventory-tab-row" role="tablist" aria-label="Profile content tabs">
              <button className={`inventory-tab ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')} role="tab" type="button">
                <Newspaper size={15} /> Posts ({data.stats.posts})
              </button>
              <button className={`inventory-tab ${activeTab === 'creations' ? 'active' : ''}`} onClick={() => setActiveTab('creations')} role="tab" type="button">
                <Scissors size={15} /> Creations ({data.stats.creations})
              </button>
              <button className={`inventory-tab ${activeTab === 'patterns' ? 'active' : ''}`} onClick={() => setActiveTab('patterns')} role="tab" type="button">
                <Palette size={15} /> Patterns ({data.stats.patterns})
              </button>
              <button className={`inventory-tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')} role="tab" type="button">
                <MessageCircle size={15} /> Comments ({data.stats.comments})
              </button>
            </div>

            <div className="catalog-sublist">
              {activeTab === 'posts'
                ? data.posts.length
                  ? data.posts.map((post) => (
                      <Link className="catalog-subrow" key={post.id} params={{ postId: post.id }} to="/post/$postId">
                        <div>
                          <strong>{post.title || post.body.slice(0, 80) || 'Post'}</strong>
                          <span>{new Date(post.updatedAt).toLocaleString()}</span>
                        </div>
                      </Link>
                    ))
                  : <p>No public posts yet.</p>
                : null}

              {activeTab === 'patterns'
                ? data.patterns.length
                  ? data.patterns.map((pattern) => (
                      <div className="catalog-subrow" key={pattern.id}>
                        <div>
                          <strong>{pattern.title}</strong>
                          <span>
                            {pattern.difficulty ? `${pattern.difficulty} · ` : ''}
                            {pattern.description ?? 'No description'}
                            {pattern.hasPdf ? ' · Download available' : ''}
                          </span>
                        </div>
                        {pattern.hasPdf ? (
                          <a className="button" href={`/api/patterns/${pattern.id}/file`}>
                            <Download size={14} /> Download
                          </a>
                        ) : null}
                      </div>
                    ))
                  : <p>No public patterns yet.</p>
                : null}

              {activeTab === 'creations'
                ? data.creations.length
                  ? data.creations.map((creation) => (
                      <div className="catalog-subrow" key={creation.id}>
                        <div>
                          <strong>{creation.name}</strong>
                          <span>{creation.status} · {creation.notes ?? 'No notes'}</span>
                        </div>
                      </div>
                    ))
                  : <p>No public creations yet.</p>
                : null}

              {activeTab === 'comments'
                ? data.comments.length
                  ? data.comments.map((comment) => (
                      <div className="catalog-subrow" key={comment.id}>
                        <div>
                          <span className="profile-comment-badge">{comment.entityType}</span>
                          {comment.targetPath ? (
                            <a className="profile-comment-link" href={comment.targetPath}>
                              {comment.body}
                            </a>
                          ) : (
                            <span>{comment.body}</span>
                          )}
                        </div>
                      </div>
                    ))
                  : <p>No comments yet.</p>
                : null}
            </div>
          </article>
        </>
      ) : null}
    </section>
  )
}
