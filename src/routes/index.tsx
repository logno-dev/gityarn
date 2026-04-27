import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Images } from 'lucide-react'
import { useEffect, useState } from 'react'

import gityarnLogo from '../../assets/gityarnlogo.svg'

export const Route = createFileRoute('/')({ component: LandingPage })

type AuthState = {
  user: { id: string; email: string; displayName: string } | null
}

type CarouselState = {
  items: Array<{
    id: string
    altText: string | null
    linkUrl: string | null
    sortOrder: number
    updatedAt: number
    imageSrc: string
  }>
}

function LandingPage() {
  const [auth, setAuth] = useState<AuthState>({ user: null })
  const [checking, setChecking] = useState(true)
  const [carousel, setCarousel] = useState<CarouselState>({ items: [] })
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data: AuthState) => setAuth(data))
      .finally(() => setChecking(false))

    fetch('/api/landing/carousel')
      .then((response) => response.json())
      .then((data: CarouselState) => setCarousel(data))
      .catch(() => setCarousel({ items: [] }))
  }, [])

  useEffect(() => {
    if (!carousel.items.length) {
      setActiveSlide(0)
      return
    }
    setActiveSlide((current) => Math.min(current, carousel.items.length - 1))
  }, [carousel.items.length])

  useEffect(() => {
    if (carousel.items.length < 2) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % carousel.items.length)
    }, 5500)

    return () => window.clearInterval(timer)
  }, [carousel.items.length])

  const activeItem = carousel.items[activeSlide] ?? null
  const goToSlide = (nextIndex: number) => {
    if (!carousel.items.length) {
      return
    }
    const count = carousel.items.length
    const normalized = ((nextIndex % count) + count) % count
    setActiveSlide(normalized)
  }

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
              Go to Discover <ArrowRight size={16} />
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

      <section className="showcase-image-slot showcase-image-carousel" aria-label="Featured highlights carousel">
        {activeItem ? (
          <div className="feature-carousel-shell">
            {activeItem.linkUrl ? (
              <a className="feature-carousel-slide" href={activeItem.linkUrl} rel="noreferrer" target="_blank">
                <img alt={activeItem.altText || 'Featured carousel item'} className="feature-carousel-image" src={activeItem.imageSrc} />
              </a>
            ) : (
              <div className="feature-carousel-slide">
                <img alt={activeItem.altText || 'Featured carousel item'} className="feature-carousel-image" src={activeItem.imageSrc} />
              </div>
            )}

            {carousel.items.length > 1 ? (
              <>
                <button
                  aria-label="Previous slide"
                  className="feature-carousel-arrow feature-carousel-arrow-prev"
                  onClick={() => goToSlide(activeSlide - 1)}
                  type="button"
                >
                  ‹
                </button>
                <button
                  aria-label="Next slide"
                  className="feature-carousel-arrow feature-carousel-arrow-next"
                  onClick={() => goToSlide(activeSlide + 1)}
                  type="button"
                >
                  ›
                </button>
                <div className="feature-carousel-dots" role="tablist" aria-label="Choose featured slide">
                  {carousel.items.map((item, index) => (
                    <button
                      aria-label={`Go to slide ${index + 1}`}
                      aria-selected={index === activeSlide}
                      className={`feature-carousel-dot ${index === activeSlide ? 'active' : ''}`}
                      key={item.id}
                      onClick={() => goToSlide(index)}
                      role="tab"
                      type="button"
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <>
            <Images size={28} />
            <h2>Feature Visual Placeholder</h2>
            <p>Carousel items will appear here once added in Admin.</p>
          </>
        )}
      </section>

      <section className="landing-filler" aria-label="Why makers use GIT Yarn">
        <div className="landing-filler-inner">
          <header>
            <h2>Keep your yarn life organized</h2>
            <p>Everything from your stash to finished makes in one practical workflow.</p>
          </header>
          <div className="landing-filler-grid">
            <article className="landing-filler-card">
              <h3>Track stash + tools</h3>
              <p>See quantities, low stock, and where each skein or hook lives before you start your next project.</p>
            </article>
            <article className="landing-filler-card">
              <h3>Build from scan to project</h3>
              <p>Scan barcode data into inventory, connect materials to patterns, and tie them directly to creations.</p>
            </article>
            <article className="landing-filler-card">
              <h3>Share progress with community</h3>
              <p>Post updates, collect feedback, and showcase finished work without losing your personal workflow.</p>
            </article>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">Copyright Get it Together Yarn {new Date().getFullYear()}</div>
      </footer>
    </section>
  )
}
