import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogIn, UserPlus } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/register')({ component: RegisterPage })

function RegisterPage() {
  const [status, setStatus] = useState('')
  const navigate = useNavigate()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('Creating account...')

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (password !== confirmPassword) {
      setStatus('Passwords do not match.')
      return
    }

    formData.delete('confirmPassword')
    const payload = Object.fromEntries(formData.entries())

    const response = await fetch('/api/auth/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as { message?: string }
    setStatus(data.message ?? 'Done')

    if (response.ok) {
      await navigate({ to: '/dashboard' })
    }
  }

  return (
    <section className="page-stack page-narrow">
      <header className="page-header">
        <h1>Create Account</h1>
        <p>Start a private GIT Yarn workspace for your stash and creations.</p>
      </header>

      <article className="soft-panel">
        <form className="stack-form" onSubmit={submit}>
          <label>
            Display name
            <input name="displayName" placeholder="Your name" required type="text" />
          </label>
          <label>
            Email
            <input name="email" placeholder="you@gityarn.com" required type="email" />
          </label>
          <label>
            Password
            <input minLength={8} name="password" required type="password" />
          </label>
          <label>
            Confirm password
            <input minLength={8} name="confirmPassword" required type="password" />
          </label>
          <button className="button button-primary" type="submit">
            <UserPlus size={16} /> Create Account
          </button>
        </form>
        <p>{status}</p>
        <p>
          Already have an account?{' '}
          <Link className="inline-link" to="/sign-in">
            <LogIn size={14} /> Sign in
          </Link>
        </p>
      </article>
    </section>
  )
}
