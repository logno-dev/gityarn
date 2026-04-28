import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { BookOpen, LoaderCircle, Newspaper, Scissors } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ingestSharedPayload } from '#/lib/share/ingest'

export const Route = createFileRoute('/share-intake')({
  component: ShareIntakePage,
  server: {
    handlers: {
      POST: async ({ request }) => ingestSharedPayload(request),
    },
  },
})

type DraftPayload = {
  draft: {
    id: string
    title: string | null
    text: string | null
    url: string | null
    consumedAt: number | null
    files: Array<{
      id: string
      kind: string
      originalFileName: string | null
      mimeType: string | null
      byteSize: number | null
      src: string
    }>
  }
}

function ShareIntakePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [draft, setDraft] = useState<DraftPayload['draft'] | null>(null)

  const draftId = useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return new URLSearchParams(window.location.search).get('draftId')?.trim() ?? ''
  }, [])

  useEffect(() => {
    if (!draftId) {
      setLoading(false)
      setError('No shared draft found in this request.')
      return
    }

    fetch(`/api/share/draft?draftId=${encodeURIComponent(draftId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as DraftPayload & { message?: string }
        if (!response.ok) {
          throw new Error(payload.message ?? 'Could not load shared content.')
        }
        return payload
      })
      .then((payload) => {
        setDraft(payload.draft)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load shared content.')
      })
      .finally(() => setLoading(false))
  }, [draftId])

  const importAs = async (target: 'post' | 'creation' | 'pattern') => {
    if (!draft) {
      return
    }
    setSaving(true)
    const response = await fetch('/api/share/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: draft.id, target }),
    })
    const payload = (await response.json()) as { message?: string; nextPath?: string }
    setStatus(payload.message ?? (response.ok ? 'Shared content imported.' : 'Could not import shared content.'))
    setSaving(false)
    if (response.ok && payload.nextPath) {
      await navigate({ to: payload.nextPath as any })
    }
  }

  const imageFiles = draft?.files.filter((file) => file.kind === 'image') ?? []
  const pdfFiles = draft?.files.filter((file) => file.kind === 'pdf') ?? []

  return (
    <section className="page-stack">
      <article className="soft-panel">
        <h2>Import Shared Content</h2>
        {loading ? <p><LoaderCircle size={14} /> Loading shared content...</p> : null}
        {error ? <p>{error}</p> : null}
        {status ? <p>{status}</p> : null}

        {!loading && !error && draft ? (
          <div className="stack-form">
            {draft.title ? (
              <p>
                <strong>Title:</strong> {draft.title}
              </p>
            ) : null}
            {draft.text ? (
              <p>
                <strong>Text:</strong> {draft.text}
              </p>
            ) : null}
            {draft.url ? (
              <p>
                <strong>URL:</strong> {draft.url}
              </p>
            ) : null}

            {imageFiles.length ? (
              <div className="share-intake-image-grid">
                {imageFiles.map((file) => (
                  <img alt={file.originalFileName || 'Shared image'} className="share-intake-image" key={file.id} src={file.src} />
                ))}
              </div>
            ) : null}

            {pdfFiles.length ? (
              <p>
                {pdfFiles.length} PDF file{pdfFiles.length === 1 ? '' : 's'} attached.
              </p>
            ) : null}

            <div className="hero-actions">
              <button className="button button-primary" disabled={saving} onClick={() => void importAs('post')} type="button">
                <Newspaper size={14} /> Import as Post
              </button>
              <button className="button" disabled={saving} onClick={() => void importAs('creation')} type="button">
                <Scissors size={14} /> Import as Creation
              </button>
              <button className="button" disabled={saving} onClick={() => void importAs('pattern')} type="button">
                <BookOpen size={14} /> Import as Pattern
              </button>
            </div>
          </div>
        ) : null}
      </article>
    </section>
  )
}
