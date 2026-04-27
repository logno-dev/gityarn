import { Link, createFileRoute } from '@tanstack/react-router'
import { LogIn, UserPlus } from 'lucide-react'

export const Route = createFileRoute('/auth')({ component: AuthPage })

function AuthPage() {
  return (
    <section className="page-stack page-narrow">
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
