import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { PdfReader } from '#/components/pdf-reader'
import type { PdfHighlight, PdfPageMetadata } from '#/components/pdf-reader'

type ReaderSearch = { lang?: string }

type PatternPayload = {
  id: string
  title: string
  hasPdf: boolean
}

type PatternVariant = {
  id: string
  languageCode: string
  languageLabel: string
}

type ReaderMetadataPayload = {
  languageCode: string
  lastReadPage: number
  pageCount: number | null
  progress: number | null
  pages: PdfPageMetadata[]
}

export const Route = createFileRoute('/pattern/$patternId_/reader')({
  validateSearch: (search: Record<string, unknown>): ReaderSearch => ({
    lang: typeof search.lang === 'string' && search.lang.trim() ? search.lang.trim() : undefined,
  }),
  component: PatternReaderPage,
})

function PatternReaderPage() {
  const { patternId } = Route.useParams()
  const { lang } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [pattern, setPattern] = useState<PatternPayload | null>(null)
  const [variants, setVariants] = useState<PatternVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metadata, setMetadata] = useState<ReaderMetadataPayload | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [highlights, setHighlights] = useState<PdfHighlight[]>([])
  const progressTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [patternResponse, variantsResponse] = await Promise.all([
          fetch(`/api/patterns/${patternId}`),
          fetch(`/api/patterns/${patternId}/variants`),
        ])
        const patternPayload = (await patternResponse.json()) as PatternPayload & { message?: string }
        if (!patternResponse.ok) throw new Error(patternPayload.message ?? 'Could not load pattern.')
        const variantsPayload = variantsResponse.ok
          ? await variantsResponse.json() as { variants: PatternVariant[] }
          : { variants: [] }
        if (!cancelled) {
          setPattern(patternPayload)
          setVariants(variantsPayload.variants)
        }
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load pattern.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [patternId])

  const selectedLanguage = lang ?? variants[0]?.languageCode ?? (pattern?.hasPdf ? 'en-US' : undefined)
  const fileUrl = `/api/patterns/${patternId}/file${selectedLanguage ? `?lang=${encodeURIComponent(selectedLanguage)}` : ''}`

  useEffect(() => {
    if (!selectedLanguage) return
    let cancelled = false
    setMetadataLoading(true)
    const loadMetadata = async () => {
      try {
        const [metadataResponse, highlightsResponse] = await Promise.all([
          fetch(`/api/patterns/${patternId}/reader-metadata?lang=${encodeURIComponent(selectedLanguage)}`),
          fetch(`/api/patterns/${patternId}/reader-highlights?lang=${encodeURIComponent(selectedLanguage)}`),
        ])
        if (!metadataResponse.ok) throw new Error('Could not load reading progress.')
        const metadataPayload = await metadataResponse.json() as ReaderMetadataPayload
        const highlightsPayload = highlightsResponse.ok
          ? await highlightsResponse.json() as { highlights: PdfHighlight[] }
          : { highlights: [] }
        if (!cancelled) {
          setMetadata(metadataPayload)
          setHighlights(highlightsPayload.highlights)
        }
      } catch {
        if (!cancelled) {
          setMetadata({ languageCode: selectedLanguage, lastReadPage: 1, pageCount: null, progress: null, pages: [] })
          setHighlights([])
        }
      } finally {
        if (!cancelled) setMetadataLoading(false)
      }
    }
    void loadMetadata()
    return () => {
      cancelled = true
      if (progressTimer.current !== null) window.clearTimeout(progressTimer.current)
    }
  }, [patternId, selectedLanguage])

  const saveProgress = (page: number, pageCount: number) => {
    if (!selectedLanguage) return
    if (progressTimer.current !== null) window.clearTimeout(progressTimer.current)
    progressTimer.current = window.setTimeout(() => {
      void fetch(`/api/patterns/${patternId}/reader-metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'progress', languageCode: selectedLanguage, lastReadPage: page, pageCount }),
      })
    }, 400)
  }

  const savePageMetadata = async (next: PdfPageMetadata) => {
    if (!selectedLanguage) return
    const previousMetadata = metadata
    setMetadata((current) => current ? {
      ...current,
      pages: [...current.pages.filter((item) => item.pageNumber !== next.pageNumber), next]
        .filter((item) => item.isBookmarked || item.bookmarkLabel || item.note)
        .sort((left, right) => left.pageNumber - right.pageNumber),
    } : current)
    try {
      const response = await fetch(`/api/patterns/${patternId}/reader-metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'page', languageCode: selectedLanguage, ...next }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(payload?.message ?? 'Could not save page metadata.')
      }
    } catch (error) {
      setMetadata(previousMetadata)
      throw error
    }
  }

  const createHighlight = async (next: Omit<PdfHighlight, 'id' | 'note'>) => {
    if (!selectedLanguage) return
    const response = await fetch(`/api/patterns/${patternId}/reader-highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageCode: selectedLanguage, ...next }),
    })
    const payload = await response.json().catch(() => null) as { highlight?: PdfHighlight; message?: string } | null
    if (!response.ok || !payload?.highlight) throw new Error(payload?.message ?? 'Could not save highlight.')
    setHighlights((current) => [...current, payload.highlight as PdfHighlight])
  }

  const deleteHighlight = async (id: string) => {
    const previous = highlights
    setHighlights((current) => current.filter((item) => item.id !== id))
    const response = await fetch(`/api/patterns/${patternId}/reader-highlights?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!response.ok) {
      setHighlights(previous)
      throw new Error('Could not delete highlight.')
    }
  }

  const updateHighlightNote = async (id: string, note: string | null) => {
    const response = await fetch(`/api/patterns/${patternId}/reader-highlights`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, note }),
    })
    if (!response.ok) throw new Error('Could not save highlight note.')
    setHighlights((current) => current.map((item) => item.id === id ? { ...item, note } : item))
  }

  return (
    <section className="pattern-reader-page">
      <div className="pattern-reader-heading">
        <Link className="button" params={{ patternId }} to="/pattern/$patternId">
          <ArrowLeft size={16} /> Pattern details
        </Link>
        <div>
          <span className="kicker">Gityarn reader</span>
          <h1>{pattern?.title ?? 'Pattern'}</h1>
        </div>
        {variants.length > 1 ? (
          <label className="pattern-reader-language">
            <span>Language</span>
            <select
              onChange={(event) => void navigate({ search: { lang: event.target.value }, replace: true })}
              value={selectedLanguage}
            >
              {variants.map((variant) => <option key={variant.id} value={variant.languageCode}>{variant.languageLabel}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {loading ? <p>Loading reader...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && pattern?.hasPdf && metadataLoading ? <p>Restoring your reading progress...</p> : null}
      {!loading && !metadataLoading && pattern?.hasPdf ? (
        <PdfReader
          fileUrl={fileUrl}
          initialPage={metadata?.lastReadPage}
          highlights={highlights}
          key={fileUrl}
          onHighlightCreate={createHighlight}
          onHighlightDelete={deleteHighlight}
          onHighlightNoteChange={updateHighlightNote}
          onPageMetadataChange={savePageMetadata}
          onProgressChange={saveProgress}
          pageMetadata={metadata?.pages}
          title={pattern.title}
        />
      ) : null}
      {!loading && pattern && !pattern.hasPdf ? <p>This pattern does not have a PDF yet.</p> : null}
    </section>
  )
}
