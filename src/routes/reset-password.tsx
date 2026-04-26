import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { KeyRound, LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/reset-password')({ component: ResetPasswordPage })

function ResetPasswordPage() {
  const [status, setStatus] = useState('')
  const [token, setToken] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    setToken(new URLSearchParams(window.location.search).get('token') ?? '')
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) {
      setStatus('Reset token is missing.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const newPassword = String(formData.get('newPassword') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')
    if (newPassword !== confirmPassword) {
      setStatus('Passwords do not match.')
      return
    }

    setStatus('Resetting password...')

    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    })

    const data = (await response.json()) as { message?: string }
    setStatus(data.message ?? 'Password reset complete.')

    if (response.ok) {
      await navigate({ to: '/sign-in' })
    }
  }

  return (
    <section className="page-stack page-narrow">
      <header className="page-header">
        <h1>Reset Password</h1>
        <p>Create a new password for your GIT Yarn account.</p>
      </header>

      <article className="soft-panel">
        <form className="stack-form" onSubmit={submit}>
          <label>
            New password
            <input minLength={8} name="newPassword" required type="password" />
          </label>
          <label>
            Confirm new password
            <input minLength={8} name="confirmPassword" required type="password" />
          </label>
          <button className="button button-primary" type="submit">
            <KeyRound size={16} /> Update password
          </button>
        </form>
        <p>{status}</p>
        <p>
          Back to{' '}
          <Link className="inline-link" to="/sign-in">
            <LogIn size={14} /> Sign in
          </Link>
        </p>
      </article>
    </section>
  )
}
