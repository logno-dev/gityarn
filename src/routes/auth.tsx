import { Link, createFileRoute } from '@tanstack/react-router'
import { LogIn, UserPlus } from 'lucide-react'

export const Route = createFileRoute('/auth')({ component: AuthPage })

function AuthPage() {
  return (
    <section className="page-stack page-narrow">
      <header className="page-header">
        <h1>Account</h1>
        <p>Choose a sign-in action to access your yarn inventory and project data.</p>
      </header>

      <div className="mode-switch">
        <Link className="button button-primary" to="/sign-in">
          <LogIn size={16} /> Go to Sign In
        </Link>
        <Link className="button" to="/register">
          <UserPlus size={16} /> Go to Register
        </Link>
      </div>
    </section>
  )
}
