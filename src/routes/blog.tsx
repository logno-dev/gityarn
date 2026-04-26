import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/blog')({ component: BlogPage })

function BlogPage() {
  return (
    <section className="page-stack page-narrow">
      <header className="page-header">
        <h1>Blog</h1>
        <p>Blog and light CMS features will live here as the marketing layer expands.</p>
      </header>
    </section>
  )
}
