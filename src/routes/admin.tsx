import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, Save, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
}

function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [data, setData] = useState<AdminPayload | null>(null)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, 'member' | 'admin'>>({})

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

  return (
    <section className="page-stack">
      <header className="page-header">
        <h1>Admin Panel</h1>
        <p>Manage member access and monitor community moderation activity.</p>
      </header>

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
        </>
      ) : null}
    </section>
  )
}
