import { Link, createFileRoute } from '@tanstack/react-router'
import { Bell, CheckCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/notifications')({ component: NotificationsPage })

type NotificationsPayload = {
  unreadCount: number
  items: Array<{
    id: string
    type: string
    message: string
    entityType: string
    entityId: string
    targetPath: string | null
    readAt: number | null
    createdAt: number
    actorDisplayName: string | null
  }>
}

function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [data, setData] = useState<NotificationsPayload>({ unreadCount: 0, items: [] })

  const load = async () => {
    setLoading(true)
    const response = await fetch('/api/notifications')
    const payload = (await response.json()) as NotificationsPayload & { message?: string }
    if (!response.ok) {
      setStatus(payload.message ?? 'Could not load notifications.')
      setLoading(false)
      return
    }
    setData(payload)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const markAllRead = async () => {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Updated notifications.' : 'Could not update notifications.'))
    if (response.ok) {
      await load()
    }
  }

  return (
    <section className="page-stack discover-page">
      <article className="soft-panel">
        <div className="discover-card-head">
          <strong><Bell size={16} /> Notifications</strong>
          <div className="hero-actions">
            <span>{data.unreadCount} unread</span>
            <button className="button" onClick={() => void markAllRead()} type="button">
              <CheckCheck size={14} /> Mark all read
            </button>
          </div>
        </div>
        {status ? <p>{status}</p> : null}
        {loading ? <p>Loading notifications...</p> : null}
        {!loading && !data.items.length ? <p>No notifications yet.</p> : null}
        <div className="catalog-sublist">
          {data.items.map((item) => (
            <div className="catalog-subrow" key={item.id}>
              <div>
                <strong>{item.message}</strong>
                <span>{new Date(item.createdAt).toLocaleString()} {item.readAt ? '' : '· New'}</span>
              </div>
              {item.targetPath ? (
                <Link className="button" to={item.targetPath as any}>
                  Open
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
