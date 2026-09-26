import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Highlighter,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'

type PdfReaderProps = {
  fileUrl: string
  highlights?: PdfHighlight[]
  initialPage?: number
  onHighlightCreate?: (highlight: Omit<PdfHighlight, 'id' | 'note'>) => Promise<void>
  onHighlightDelete?: (id: string) => Promise<void>
  onHighlightNoteChange?: (id: string, note: string | null) => Promise<void>
  onPageMetadataChange?: (metadata: PdfPageMetadata) => Promise<void>
  onProgressChange?: (page: number, pageCount: number) => void
  pageMetadata?: PdfPageMetadata[]
  title: string
}

export type PdfPageMetadata = {
  pageNumber: number
  isBookmarked: boolean
  bookmarkLabel: string | null
  note: string | null
}

export type PdfHighlight = {
  id: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  color: string
  note: string | null
}

export function PdfReader({ fileUrl, highlights = [], initialPage = 1, onHighlightCreate, onHighlightDelete, onHighlightNoteChange, onPageMetadataChange, onProgressChange, pageMetadata = [], title }: PdfReaderProps) {
  const readerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLElement>(null)
  const pageVisibilityRef = useRef(new Map<number, number>())
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [scale, setScale] = useState(1.25)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [thumbnailsOpen, setThumbnailsOpen] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchMatches, setSearchMatches] = useState<number[]>([])
  const [activeMatch, setActiveMatch] = useState(0)
  const [notesOpen, setNotesOpen] = useState(false)
  const [bookmarkLabel, setBookmarkLabel] = useState('')
  const [note, setNote] = useState('')
  const [metadataStatus, setMetadataStatus] = useState('')
  const [highlightMode, setHighlightMode] = useState(false)
  const [highlightColor, setHighlightColor] = useState('yellow')
  const [fillsViewport, setFillsViewport] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)')
    const updateLayout = () => {
      setIsMobile(media.matches)
      if (media.matches) setThumbnailsOpen(false)
    }
    updateLayout()
    media.addEventListener('change', updateLayout)
    return () => media.removeEventListener('change', updateLayout)
  }, [])

  useEffect(() => {
    if (!fillsViewport) return
    const previousOverflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFillsViewport(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [fillsViewport])

  useEffect(() => {
    let cancelled = false
    let loadedDocument: PDFDocumentProxy | null = null

    const load = async () => {
      setLoading(true)
      setError('')
      setDocument(null)
      setPage(1)
      setSearchMatches([])
      try {
        const [{ GlobalWorkerOptions, getDocument }, workerAsset] = await Promise.all([
          import('pdfjs-dist/legacy/build/pdf.mjs'),
          import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
        ])
        GlobalWorkerOptions.workerSrc = workerAsset.default
        loadedDocument = await getDocument({ url: fileUrl }).promise
        if (!cancelled) {
          setDocument(loadedDocument)
          setPage(Math.min(loadedDocument.numPages, Math.max(1, initialPage)))
        }
      } catch {
        if (!cancelled) setError('This PDF could not be loaded. You can still download it and open it on your device.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      void loadedDocument?.destroy()
    }
  }, [fileUrl, initialPage])

  useEffect(() => {
    const stage = stageRef.current
    if (!document || !stage) return
    pageVisibilityRef.current.clear()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const pageNumber = Number((entry.target as HTMLElement).dataset.pdfPage)
        pageVisibilityRef.current.set(pageNumber, entry.isIntersecting ? entry.intersectionRatio : 0)
      }
      let mostVisiblePage = 0
      let highestVisibility = 0
      for (const [pageNumber, visibility] of pageVisibilityRef.current) {
        if (visibility > highestVisibility) {
          mostVisiblePage = pageNumber
          highestVisibility = visibility
        }
      }
      if (mostVisiblePage) setPage(mostVisiblePage)
    }, { root: stage, threshold: [0.1, 0.25, 0.5, 0.75, 0.9] })
    stage.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((element) => observer.observe(element))
    const frame = window.requestAnimationFrame(() => scrollToPage(initialPage, 'auto'))
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [document])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  useEffect(() => {
    if (document) onProgressChange?.(page, document.numPages)
  }, [document, onProgressChange, page])

  useEffect(() => {
    if (!document || !isMobile || !stageRef.current) return
    let cancelled = false
    void document.getPage(1).then((firstPage) => {
      if (cancelled || !stageRef.current) return
      const naturalWidth = firstPage.getViewport({ scale: 1 }).width
      const availableWidth = Math.max(280, stageRef.current.clientWidth - 20)
      setScale(Math.max(0.45, Math.min(1.25, availableWidth / naturalWidth)))
    })
    return () => {
      cancelled = true
    }
  }, [document, isMobile])

  const currentMetadata = pageMetadata.find((item) => item.pageNumber === page)

  useEffect(() => {
    setBookmarkLabel(currentMetadata?.bookmarkLabel ?? '')
    setNote(currentMetadata?.note ?? '')
    setMetadataStatus('')
  }, [currentMetadata?.bookmarkLabel, currentMetadata?.note, page])

  useEffect(() => {
    if (!document) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        navigateToPage(page - 1)
      }
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        navigateToPage(page + 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [document, page])

  const scrollToPage = (nextPage: number, behavior: ScrollBehavior) => {
    const target = stageRef.current?.querySelector<HTMLElement>(`[data-pdf-page="${nextPage}"]`)
    if (target && stageRef.current) {
      stageRef.current.scrollTo({ top: Math.max(0, target.offsetTop - 16), behavior })
    }
  }

  const navigateToPage = (nextPage: number) => {
    if (!document) return
    const clampedPage = Math.min(document.numPages, Math.max(1, nextPage))
    setPage(clampedPage)
    scrollToPage(clampedPage, 'smooth')
  }

  const submitPage = (event: FormEvent) => {
    event.preventDefault()
    const nextPage = Number.parseInt(pageInput, 10)
    if (Number.isFinite(nextPage)) navigateToPage(nextPage)
    else setPageInput(String(page))
  }

  const runSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (!document || !searchInput.trim()) {
      setSearchMatches([])
      return
    }
    setSearching(true)
    const needle = searchInput.trim().toLocaleLowerCase()
    const matches: number[] = []
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const pdfPage = await document.getPage(pageNumber)
        const text = await pdfPage.getTextContent()
        const pageText = text.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .toLocaleLowerCase()
        if (pageText.includes(needle)) matches.push(pageNumber)
      }
      setSearchMatches(matches)
      setActiveMatch(0)
      if (matches[0]) navigateToPage(matches[0])
    } finally {
      setSearching(false)
    }
  }

  const moveSearchMatch = (direction: -1 | 1) => {
    if (!searchMatches.length) return
    const next = (activeMatch + direction + searchMatches.length) % searchMatches.length
    setActiveMatch(next)
    navigateToPage(searchMatches[next] ?? 1)
  }

  const saveMetadata = async (next: PdfPageMetadata) => {
    if (!onPageMetadataChange) return
    setMetadataStatus('Saving...')
    try {
      await onPageMetadataChange(next)
      setMetadataStatus('Saved')
    } catch {
      setMetadataStatus('Could not save')
    }
  }

  const toggleBookmark = () => {
    void saveMetadata({
      pageNumber: page,
      isBookmarked: !currentMetadata?.isBookmarked,
      bookmarkLabel: bookmarkLabel.trim() || null,
      note: note.trim() || null,
    })
  }

  const submitMetadata = (event: FormEvent) => {
    event.preventDefault()
    void saveMetadata({
      pageNumber: page,
      isBookmarked: currentMetadata?.isBookmarked ?? false,
      bookmarkLabel: bookmarkLabel.trim() || null,
      note: note.trim() || null,
    })
  }

  const createHighlight = async (highlight: Omit<PdfHighlight, 'id' | 'note'>) => {
    if (!onHighlightCreate) return
    setMetadataStatus('Saving highlight...')
    try {
      await onHighlightCreate(highlight)
      setMetadataStatus('Highlight saved')
      setNotesOpen(true)
    } catch {
      setMetadataStatus('Could not save')
    }
  }

  const deleteHighlight = async (id: string) => {
    if (!onHighlightDelete) return
    setMetadataStatus('Deleting...')
    try {
      await onHighlightDelete(id)
      setMetadataStatus('Highlight deleted')
    } catch {
      setMetadataStatus('Could not save')
    }
  }

  return (
    <div className={`pdf-reader ${fillsViewport ? 'viewport-fill' : ''}`} ref={readerRef}>
      <header className="pdf-reader-toolbar">
        <button
          aria-label={thumbnailsOpen ? 'Hide thumbnails' : 'Show thumbnails'}
          className="icon-button"
          onClick={() => setThumbnailsOpen((current) => !current)}
          type="button"
        >
          {thumbnailsOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>

        <form className="pdf-page-controls" onSubmit={submitPage}>
          <button aria-label="Previous page" className="icon-button" disabled={page <= 1} onClick={() => navigateToPage(page - 1)} type="button">
            <ChevronLeft size={18} />
          </button>
          <label>
            <span className="sr-only">Current page</span>
            <input inputMode="numeric" onChange={(event) => setPageInput(event.target.value)} value={pageInput} />
          </label>
          <span>of {document?.numPages ?? '...'}</span>
          <button aria-label="Next page" className="icon-button" disabled={!document || page >= document.numPages} onClick={() => navigateToPage(page + 1)} type="button">
            <ChevronRight size={18} />
          </button>
        </form>

        <div className="pdf-zoom-controls">
          <button aria-label="Zoom out" className="icon-button" disabled={scale <= 0.75} onClick={() => setScale((current) => Math.max(0.75, current - 0.25))} type="button">
            <Minus size={17} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button aria-label="Zoom in" className="icon-button" disabled={scale >= 2.5} onClick={() => setScale((current) => Math.min(2.5, current + 0.25))} type="button">
            <Plus size={17} />
          </button>
        </div>

        <form className="pdf-search" onSubmit={(event) => void runSearch(event)}>
          <Search aria-hidden="true" size={16} />
          <input aria-label="Search PDF" onChange={(event) => setSearchInput(event.target.value)} placeholder="Search pattern" type="search" value={searchInput} />
          <button className="button" disabled={searching || !document} type="submit">{searching ? 'Searching...' : 'Find'}</button>
          {searchMatches.length ? (
            <span className="pdf-search-results">
              {activeMatch + 1} / {searchMatches.length}
              <button aria-label="Previous result" className="icon-button" onClick={() => moveSearchMatch(-1)} type="button"><ChevronLeft size={15} /></button>
              <button aria-label="Next result" className="icon-button" onClick={() => moveSearchMatch(1)} type="button"><ChevronRight size={15} /></button>
            </span>
          ) : searchInput && !searching ? <span className="pdf-search-empty">No matches</span> : null}
        </form>

        <div className="pdf-reader-actions">
          <a aria-label="Download PDF" className="icon-button pdf-download" download href={fileUrl}>
            <Download size={18} />
          </a>
          <button
            aria-label={currentMetadata?.isBookmarked ? 'Remove page bookmark' : 'Bookmark this page'}
            className={`icon-button ${currentMetadata?.isBookmarked ? 'active' : ''}`}
            onClick={toggleBookmark}
            type="button"
          >
            <Bookmark fill={currentMetadata?.isBookmarked ? 'currentColor' : 'none'} size={18} />
          </button>
          <button aria-label={notesOpen ? 'Hide notes' : 'Show notes'} className={`icon-button ${notesOpen ? 'active' : ''}`} onClick={() => setNotesOpen((current) => !current)} type="button">
            <StickyNote size={18} />
          </button>
          <button aria-label={highlightMode ? 'Turn off highlighter' : 'Highlight an area'} className={`icon-button ${highlightMode ? 'active' : ''}`} onClick={() => setHighlightMode((current) => !current)} type="button">
            <Highlighter size={18} />
          </button>
          {highlightMode ? (
            <div aria-label="Highlight color" className="pdf-highlight-colors" role="group">
              {['yellow', 'pink', 'mint'].map((color) => (
                <button aria-label={`${color} highlight`} aria-pressed={highlightColor === color} className={`pdf-highlight-color ${color}`} key={color} onClick={() => setHighlightColor(color)} type="button" />
              ))}
            </div>
          ) : null}
          <button aria-label={fillsViewport ? 'Exit full-window view' : 'Fill viewport'} className="icon-button" onClick={() => setFillsViewport((current) => !current)} type="button">
            {fillsViewport ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        {metadataStatus ? <span aria-live="polite" className={`pdf-toolbar-status ${metadataStatus === 'Could not save' ? 'error' : ''}`}>{metadataStatus}</span> : null}
      </header>

      <div className={`pdf-reader-body ${thumbnailsOpen ? '' : 'thumbnails-hidden'} ${notesOpen ? 'notes-open' : ''}`}>
        {thumbnailsOpen && document ? (
          <aside aria-label="Page thumbnails" className="pdf-thumbnails">
            {Array.from({ length: document.numPages }, (_, index) => {
              const pageNumber = index + 1
               return <PdfThumbnail active={pageNumber === page} bookmarked={pageMetadata.some((item) => item.pageNumber === pageNumber && item.isBookmarked)} document={document} key={pageNumber} onSelect={(nextPage) => { navigateToPage(nextPage); if (isMobile) setThumbnailsOpen(false) }} pageNumber={pageNumber} />
            })}
          </aside>
        ) : null}

        <main aria-label={`${title} PDF`} className="pdf-page-stage" ref={stageRef}>
          {loading ? <div className="pdf-reader-message"><LoaderCircle className="pdf-spinner" size={28} /> Loading pattern...</div> : null}
          {error ? (
            <div className="pdf-reader-message">
              <p>{error}</p>
              <a className="button" href={fileUrl}>Open original PDF</a>
            </div>
          ) : null}
          {document ? (
            <div className="pdf-continuous-pages">
              {Array.from({ length: document.numPages }, (_, index) => (
                <PdfContinuousPage
                  document={document}
                  highlightColor={highlightColor}
                  highlightMode={highlightMode}
                  highlights={highlights.filter((item) => item.pageNumber === index + 1)}
                  key={index + 1}
                  onHighlightCreate={(highlight) => void createHighlight(highlight)}
                  pageNumber={index + 1}
                  scale={scale}
                />
              ))}
            </div>
          ) : null}
        </main>
        {notesOpen ? (
          <aside className="pdf-notes-panel">
            <div className="pdf-notes-heading">
              <div>
                <span className="kicker">Page {page}</span>
                <h2>Notes & bookmark</h2>
              </div>
              <button aria-label="Close notes" className="icon-button" onClick={() => setNotesOpen(false)} type="button"><PanelLeftClose size={17} /></button>
            </div>
            <form className="stack-form" onSubmit={submitMetadata}>
              <label>
                Bookmark label
                <input maxLength={200} onChange={(event) => setBookmarkLabel(event.target.value)} placeholder="e.g. Sleeve decrease" value={bookmarkLabel} />
              </label>
              <label>
                Personal note
                <textarea maxLength={10_000} onChange={(event) => setNote(event.target.value)} placeholder="Add a note for this page..." rows={7} value={note} />
              </label>
              <div className="pdf-note-actions">
                <button className="button button-primary" type="submit">Save page note</button>
                <span>{metadataStatus}</span>
              </div>
            </form>
            <div className="pdf-bookmark-list">
              <strong>Bookmarks</strong>
              {pageMetadata.some((item) => item.isBookmarked) ? pageMetadata.filter((item) => item.isBookmarked).map((item) => (
                <button className="pdf-bookmark-link" key={item.pageNumber} onClick={() => navigateToPage(item.pageNumber)} type="button">
                  <Bookmark fill="currentColor" size={14} />
                  <span>{item.bookmarkLabel || `Page ${item.pageNumber}`}</span>
                  <small>p. {item.pageNumber}</small>
                </button>
              )) : <p>No bookmarks yet.</p>}
            </div>
            <div className="pdf-bookmark-list">
              <strong>Highlights on this page</strong>
              {highlights.some((item) => item.pageNumber === page) ? highlights.filter((item) => item.pageNumber === page).map((highlight, index) => (
                <HighlightNoteEditor
                  highlight={highlight}
                  index={index}
                  key={highlight.id}
                  onDelete={() => void deleteHighlight(highlight.id)}
                  onSave={async (nextNote) => {
                    if (!onHighlightNoteChange) return
                    setMetadataStatus('Saving...')
                    try {
                      await onHighlightNoteChange(highlight.id, nextNote)
                      setMetadataStatus('Saved')
                    } catch {
                      setMetadataStatus('Could not save')
                    }
                  }}
                />
              )) : <p>Turn on the highlighter, then drag over the page.</p>}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

function PdfContinuousPage({ document, highlightColor, highlightMode, highlights, onHighlightCreate, pageNumber, scale }: { document: PDFDocumentProxy; highlightColor: string; highlightMode: boolean; highlights: PdfHighlight[]; onHighlightCreate: (highlight: Omit<PdfHighlight, 'id' | 'note'>) => void; pageNumber: number; scale: number }) {
  const shellRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [nearViewport, setNearViewport] = useState(pageNumber <= 3)
  const [rendering, setRendering] = useState(false)
  const [pageSize, setPageSize] = useState({ width: Math.round(612 * scale), height: Math.round(792 * scale) })
  const [draft, setDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  useEffect(() => {
    const shell = shellRef.current
    if (!shell || nearViewport || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setNearViewport(true)
        observer.disconnect()
      }
    }, { root: shell.closest('.pdf-page-stage'), rootMargin: '900px 0px' })
    observer.observe(shell)
    return () => observer.disconnect()
  }, [nearViewport])

  useEffect(() => {
    if (!nearViewport || !canvasRef.current) return
    let task: RenderTask | null = null
    let cancelled = false
    const render = async () => {
      setRendering(true)
      try {
        const pdfPage = await document.getPage(pageNumber)
        if (cancelled || !canvasRef.current) return
        const viewport = pdfPage.getViewport({ scale })
        setPageSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return
        const outputScale = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        task = pdfPage.render({
          canvas,
          canvasContext: context,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          viewport,
        })
        await task.promise
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    void render().catch(() => undefined)
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [document, nearViewport, pageNumber, scale])

  const pointerPosition = (event: React.PointerEvent) => {
    const bounds = shellRef.current?.getBoundingClientRect()
    if (!bounds) return null
    return {
      x: Math.round(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) * 10_000),
      y: Math.round(Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) * 10_000),
    }
  }

  const startHighlight = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!highlightMode || event.button !== 0) return
    const position = pointerPosition(event)
    if (!position) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = position
    setDraft({ ...position, width: 0, height: 0 })
  }

  const moveHighlight = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return
    const position = pointerPosition(event)
    if (!position) return
    setDraft({
      x: Math.min(dragStartRef.current.x, position.x),
      y: Math.min(dragStartRef.current.y, position.y),
      width: Math.abs(position.x - dragStartRef.current.x),
      height: Math.abs(position.y - dragStartRef.current.y),
    })
  }

  const finishHighlight = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !draft) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    dragStartRef.current = null
    if (draft.width >= 80 && draft.height >= 40) onHighlightCreate({ pageNumber, ...draft, color: highlightColor })
    setDraft(null)
  }

  return (
    <div
      aria-label={`Page ${pageNumber} of ${document.numPages}`}
      className="pdf-continuous-page"
      data-pdf-page={pageNumber}
      onPointerCancel={finishHighlight}
      onPointerDown={startHighlight}
      onPointerMove={moveHighlight}
      onPointerUp={finishHighlight}
      ref={shellRef}
      style={{ height: `${pageSize.height}px`, width: `${pageSize.width}px` }}
    >
      {rendering ? <LoaderCircle aria-label={`Rendering page ${pageNumber}`} className="pdf-page-spinner pdf-spinner" size={24} /> : null}
      <canvas ref={canvasRef} />
      <div className={`pdf-highlight-layer ${highlightMode ? 'drawing' : ''}`}>
        {highlights.map((highlight) => <HighlightRegion highlight={highlight} key={highlight.id} />)}
        {draft ? <HighlightRegion highlight={{ id: 'draft', pageNumber, ...draft, color: highlightColor, note: null }} /> : null}
      </div>
    </div>
  )
}

function HighlightRegion({ highlight }: { highlight: PdfHighlight }) {
  return <span className={`pdf-highlight-region ${highlight.color}`} style={{ left: `${highlight.x / 100}%`, top: `${highlight.y / 100}%`, width: `${highlight.width / 100}%`, height: `${highlight.height / 100}%` }} />
}

function HighlightNoteEditor({ highlight, index, onDelete, onSave }: { highlight: PdfHighlight; index: number; onDelete: () => void; onSave: (note: string | null) => Promise<void> }) {
  const [note, setNote] = useState(highlight.note ?? '')
  return (
    <div className="pdf-highlight-editor">
      <div>
        <span className={`pdf-highlight-swatch ${highlight.color}`} />
        <strong>Highlight {index + 1}</strong>
        <button aria-label={`Delete highlight ${index + 1}`} className="icon-button" onClick={onDelete} type="button"><Trash2 size={14} /></button>
      </div>
      <textarea maxLength={2_000} onChange={(event) => setNote(event.target.value)} placeholder="Optional annotation..." rows={3} value={note} />
      <button className="button" onClick={() => void onSave(note.trim() || null)} type="button">Save annotation</button>
    </div>
  )
}

function PdfThumbnail({ active, bookmarked, document, onSelect, pageNumber }: { active: boolean; bookmarked: boolean; document: PDFDocumentProxy; onSelect: (page: number) => void; pageNumber: number }) {
  const shellRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(pageNumber <= 3)

  useEffect(() => {
    const shell = shellRef.current
    if (!shell || visible || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '180px' })
    observer.observe(shell)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !canvasRef.current) return
    let task: RenderTask | null = null
    let cancelled = false
    const render = async () => {
      const pdfPage: PDFPageProxy = await document.getPage(pageNumber)
      if (cancelled || !canvasRef.current) return
      const initial = pdfPage.getViewport({ scale: 1 })
      const viewport = pdfPage.getViewport({ scale: 128 / initial.width })
      const context = canvasRef.current.getContext('2d')
      if (!context) return
      canvasRef.current.width = Math.floor(viewport.width)
      canvasRef.current.height = Math.floor(viewport.height)
      task = pdfPage.render({ canvas: canvasRef.current, canvasContext: context, viewport })
      await task.promise
    }
    void render().catch(() => undefined)
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [document, pageNumber, visible])

  return (
    <button aria-current={active ? 'page' : undefined} className={`pdf-thumbnail ${active ? 'active' : ''}`} onClick={() => onSelect(pageNumber)} ref={shellRef} type="button">
      <canvas aria-hidden="true" ref={canvasRef} />
      <span>{pageNumber}{bookmarked ? <Bookmark aria-label="Bookmarked" fill="currentColor" size={11} /> : null}</span>
    </button>
  )
}
