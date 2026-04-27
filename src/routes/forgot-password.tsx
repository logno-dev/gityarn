import { Link, createFileRoute } from '@tanstack/react-router'
import { KeyRound, LogIn } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/forgot-password')({ component: ForgotPasswordPage })

function ForgotPasswordPage() {
  const [status, setStatus] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('Sending reset link...')

    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())

    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as { message?: string }
    setStatus(data.message ?? 'If that email exists, a reset link has been sent.')
  }

  return (
    <section className="page-stack page-narrow">
      <article className="soft-panel">
        <form className="stack-form" onSubmit={submit}>
          <label>
            Email
            <input name="email" placeholder="you@gityarn.com" required type="email" />
          </label>
          <button className="button button-primary" type="submit">
            <KeyRound size={16} /> Send reset link
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
