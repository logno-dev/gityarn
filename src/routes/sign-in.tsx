import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogIn, UserPlus } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/sign-in')({ component: SignInPage })

function SignInPage() {
  const [status, setStatus] = useState('')
  const navigate = useNavigate()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('Signing in...')

    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())

    const response = await fetch('/api/auth/sign-in', {
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
        <h1>Sign In</h1>
        <p>Access your inventory workspace with your email and password.</p>
      </header>

      <article className="soft-panel">
        <form className="stack-form" onSubmit={submit}>
          <label>
            Email
            <input name="email" placeholder="you@gityarn.com" required type="email" />
          </label>
          <label>
            Password
            <input minLength={8} name="password" required type="password" />
          </label>
          <button className="button button-primary" type="submit">
            <LogIn size={16} /> Sign In
          </button>
        </form>
        <p>{status}</p>
        <p>
          <Link className="inline-link" to="/forgot-password">
            Forgot your password?
          </Link>
        </p>
        <p>
          Need an account?{' '}
          <Link className="inline-link" to="/register">
            <UserPlus size={14} /> Register here
          </Link>
        </p>
      </article>
    </section>
  )
}
