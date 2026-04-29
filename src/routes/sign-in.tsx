import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

export const Route = createFileRoute('/sign-in')({ component: SignInPage })

function SignInPage() {
  const [status, setStatus] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      <article className="soft-panel">
        <form className="stack-form" onSubmit={submit}>
          <label>
            Email
            <input name="email" placeholder="you@gityarn.com" required type="email" />
          </label>
          <label>
            Password
            <div className="password-input-wrap">
              <input minLength={8} name="password" required type={showPassword ? 'text' : 'password'} />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
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
