import { createFileRoute } from '@tanstack/react-router'
import { ImagePlus, KeyRound, Save, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/account-settings')({ component: AccountSettingsPage })

type AccountPayload = {
  profile: {
    id: string
    email: string
    displayName: string
    bio: string | null
    websiteUrl: string | null
    instagramUrl: string | null
    ravelryUrl: string | null
    tiktokUrl: string | null
    youtubeUrl: string | null
    role: 'member' | 'admin'
    createdAt: number
    updatedAt: number
    avatarUpdatedAt: number | null
  }
  security: {
    activeSessionCount: number
  }
}

function AccountSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AccountPayload | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarVersion, setAvatarVersion] = useState<number | null>(null)
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    bio: '',
    websiteUrl: '',
    instagramUrl: '',
    ravelryUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
  })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const load = async () => {
    setLoading(true)
    setError(null)
    const response = await fetch('/api/account-settings')
    const payload = (await response.json()) as AccountPayload & { message?: string }
    if (!response.ok) {
      setError(payload.message ?? 'Could not load account settings.')
      setLoading(false)
      return
    }

    setData(payload)
    setAvatarVersion(payload.profile.avatarUpdatedAt)
    setProfileForm({
      displayName: payload.profile.displayName,
      email: payload.profile.email,
      bio: payload.profile.bio ?? '',
      websiteUrl: payload.profile.websiteUrl ?? '',
      instagramUrl: payload.profile.instagramUrl ?? '',
      ravelryUrl: payload.profile.ravelryUrl ?? '',
      tiktokUrl: payload.profile.tiktokUrl ?? '',
      youtubeUrl: payload.profile.youtubeUrl ?? '',
    })
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const response = await fetch('/api/account-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileForm),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Profile updated.' : 'Could not update profile.'))
    if (response.ok) {
      await load()
    }
  }

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatus('New password and confirmation must match.')
      return
    }

    const response = await fetch('/api/account-settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
    })
    const payload = (await response.json()) as { message?: string }
    setStatus(payload.message ?? (response.ok ? 'Password updated.' : 'Could not update password.'))
    if (response.ok) {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    }
  }

  const uploadAvatar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!avatarFile) {
      setStatus('Select an image file first.')
      return
    }

    const form = new FormData()
    form.append('file', avatarFile)

    const response = await fetch('/api/account-settings/avatar', {
      method: 'POST',
      body: form,
    })
    const payload = (await response.json()) as { message?: string; avatarUpdatedAt?: number }
    setStatus(payload.message ?? (response.ok ? 'Profile photo updated.' : 'Could not upload profile photo.'))
    if (response.ok) {
      setAvatarVersion(payload.avatarUpdatedAt ?? Date.now())
      setAvatarFile(null)
      await load()
    }
  }

  const avatarInitial = profileForm.displayName.trim().slice(0, 1).toUpperCase() || 'U'
  const avatarSrc = avatarVersion ? `/api/account-settings/avatar?v=${avatarVersion}` : ''

  return (
    <section className="page-stack page-narrow">
      {loading ? <p>Loading account settings...</p> : null}
      {error ? <p>{error}</p> : null}
      {status ? <p>{status}</p> : null}

      {!loading && !error && data ? (
        <div className="settings-grid">
          <article className="soft-panel">
            <h2>
              <ImagePlus size={16} /> Profile photo
            </h2>
            <form className="stack-form" onSubmit={uploadAvatar}>
              <div className="avatar-preview-shell">
                {avatarVersion ? <img alt="Profile" className="avatar-preview" src={avatarSrc} /> : <div className="avatar-fallback">{avatarInitial}</div>}
              </div>
              <label>
                Upload image
                <input accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} type="file" />
              </label>
              <button className="button" type="submit">
                <Save size={14} /> Save photo
              </button>
            </form>
          </article>

          <article className="soft-panel">
            <h2>
              <UserRound size={16} /> Profile
            </h2>
            <form className="stack-form" onSubmit={saveProfile}>
              <label>
                Display name
                <input
                  onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))}
                  type="text"
                  value={profileForm.displayName}
                />
              </label>
              <label>
                Email
                <input
                  onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                  type="email"
                  value={profileForm.email}
                />
              </label>
              <label>
                Bio
                <textarea
                  onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                  rows={4}
                  value={profileForm.bio}
                />
              </label>
              <label>
                Website
                <input
                  onChange={(event) => setProfileForm((current) => ({ ...current, websiteUrl: event.target.value }))}
                  placeholder="https://your-site.com"
                  type="url"
                  value={profileForm.websiteUrl}
                />
              </label>
              <label>
                Instagram
                <input
                  onChange={(event) => setProfileForm((current) => ({ ...current, instagramUrl: event.target.value }))}
                  placeholder="https://instagram.com/yourname"
                  type="url"
                  value={profileForm.instagramUrl}
                />
              </label>
              <label>
                Ravelry
                <input
                  onChange={(event) => setProfileForm((current) => ({ ...current, ravelryUrl: event.target.value }))}
                  placeholder="https://ravelry.com/people/yourname"
                  type="url"
                  value={profileForm.ravelryUrl}
                />
              </label>
              <label>
                TikTok
                <input
                  onChange={(event) => setProfileForm((current) => ({ ...current, tiktokUrl: event.target.value }))}
                  placeholder="https://www.tiktok.com/@yourname"
                  type="url"
                  value={profileForm.tiktokUrl}
                />
              </label>
              <label>
                YouTube
                <input
                  onChange={(event) => setProfileForm((current) => ({ ...current, youtubeUrl: event.target.value }))}
                  placeholder="https://youtube.com/@yourname"
                  type="url"
                  value={profileForm.youtubeUrl}
                />
              </label>
              <div className="settings-meta-row">
                <span>Role: {data.profile.role}</span>
                <span>Active sessions: {data.security.activeSessionCount}</span>
              </div>
              <button className="button button-primary" type="submit">
                <Save size={14} /> Save profile
              </button>
            </form>
          </article>

          <article className="soft-panel">
            <h2>
              <KeyRound size={16} /> Password
            </h2>
            <form className="stack-form" onSubmit={savePassword}>
              <label>
                Current password
                <input
                  onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                  type="password"
                  value={passwordForm.currentPassword}
                />
              </label>
              <label>
                New password
                <input
                  onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                  type="password"
                  value={passwordForm.newPassword}
                />
              </label>
              <label>
                Confirm new password
                <input
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  type="password"
                  value={passwordForm.confirmPassword}
                />
              </label>
              <button className="button button-primary" type="submit">
                <Save size={14} /> Update password
              </button>
            </form>
          </article>
        </div>
      ) : null}
    </section>
  )
}
