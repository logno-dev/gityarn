import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, BookOpenText, Images, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import gityarnLogo from '../../assets/gityarnlogo.svg'

export const Route = createFileRoute('/')({ component: LandingPage })

type AuthState = {
  user: { id: string; email: string; displayName: string } | null
}

function LandingPage() {
  const [auth, setAuth] = useState<AuthState>({ user: null })
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data: AuthState) => setAuth(data))
      .finally(() => setChecking(false))
  }, [])

  return (
    <section className="showcase-flow">
      <section className="showcase-hero">
        <img alt="GIT Yarn" className="landing-wordmark" src={gityarnLogo} />
        <h1>One hub for every skein, stitch, and finished piece.</h1>
        <p>
          GIT Yarn gives crocheters and knitters a clean home for stash inventory, tools, patterns, and barcode-linked
          catalog records.
        </p>
        <div className="hero-actions">
          {!checking && auth.user ? (
            <Link className="button button-primary" to="/dashboard">
              Go to Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link className="button button-primary" to="/register">
                Create Account <ArrowRight size={16} />
              </Link>
              <Link className="button" to="/sign-in">
                Sign In
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="showcase-image-slot" aria-label="Hero image placeholder">
        <Images size={28} />
        <h2>Feature Visual Placeholder</h2>
        <p>Reserved for editorial hero photography, campaign art, or seasonal yarn collections.</p>
      </section>

      <section className="showcase-carousel" aria-label="Featured highlights">
        <header>
          <h2>Featured Highlights</h2>
          <p>A single-column carousel band for admin-managed promotional content.</p>
        </header>
        <div className="showcase-rail">
          <article className="showcase-slide">
            <Sparkles size={18} />
            <h3>Pattern Spotlight</h3>
            <p>Highlight new collections, themes, and community favorites.</p>
          </article>
          <article className="showcase-slide">
            <BookOpenText size={18} />
            <h3>Blog + Tutorials</h3>
            <p>Future publishing surface for maker stories and educational content.</p>
          </article>
        </div>
      </section>
    </section>
  )
}
