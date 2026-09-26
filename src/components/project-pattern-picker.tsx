import { Check, FilePlus2, Plus, Search, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { FileDropInput } from './file-drop-input'

export type ProjectPatternChoice = {
  id: string
  title: string
  sourceUrl: string | null
  patternType: string
  hasPdf: boolean
}

type PatternSearchResult = ProjectPatternChoice & {
  description: string | null
  hasPdf: boolean
  isLinked?: boolean
  ownerDisplayName?: string | null
}

export function ProjectPatternPicker({ onChange, projectId, selected }: { onChange: (patterns: ProjectPatternChoice[]) => void; projectId: string; selected: ProjectPatternChoice[] }) {
  const [modal, setModal] = useState<'choose' | 'upload' | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatternSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [upload, setUpload] = useState({ title: '', description: '', sourceUrl: '' })
  const [pdf, setPdf] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [draftPatternId, setDraftPatternId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (modal !== 'choose') return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/scan/inventory?kind=patterns&limit=61&query=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        const payload = await response.json().catch(() => ({})) as { items?: PatternSearchResult[]; message?: string }
        if (!controller.signal.aborted) {
          setResults(response.ok ? payload.items ?? [] : [])
          setStatus(response.ok ? '' : payload.message ?? 'Could not search patterns.')
        }
      } catch (error) {
        if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : 'Could not search patterns.')
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, query ? 250 : 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [modal, query])

  useEffect(() => {
    if (!modal) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !uploading) closeModal() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [modal, uploading])

  useEffect(() => {
    if (!modal) return
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('input, button, textarea')?.focus(), 0)
  }, [modal])

  const togglePattern = (pattern: ProjectPatternChoice) => {
    onChange(selected.some((item) => item.id === pattern.id) ? selected.filter((item) => item.id !== pattern.id) : [...selected, pattern])
  }

  const uploadPattern = async () => {
    if (!upload.title.trim()) {
      setStatus('Enter a pattern title.')
      return
    }
    if (!pdf) {
      setStatus('Choose a PDF to upload.')
      return
    }
    setUploading(true)
    let patternId = draftPatternId
    try {
      if (!patternId) {
        setStatus('Creating pattern...')
        const createResponse = await fetch('/api/scan/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'patterns', ...upload, isPublic: false, publicShareConfirmed: false }),
        })
        const createPayload = await createResponse.json().catch(() => ({})) as { patternId?: string; message?: string }
        if (!createResponse.ok || !createPayload.patternId) {
          setStatus(createPayload.message ?? 'Could not create pattern.')
          setUploading(false)
          return
        }
        patternId = createPayload.patternId
        setDraftPatternId(patternId)
      } else {
        setStatus('Updating pattern details...')
        const updateResponse = await fetch('/api/scan/inventory', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'patterns', itemId: patternId, ...upload }) })
        const updatePayload = await updateResponse.json().catch(() => ({})) as { message?: string }
        if (!updateResponse.ok) {
          setStatus(updatePayload.message ?? 'Could not update the pattern before retrying.')
          setUploading(false)
          return
        }
      }

      setStatus('Uploading PDF...')
      const pdfResult = await uploadAsset(patternId, 'pdf', pdf)
      if (!pdfResult.ok) {
        setStatus(`${pdfResult.message} Retry to continue with the same inventory pattern.`)
        setUploading(false)
        return
      }
      let completionMessage = ''
      if (cover) {
        setStatus('Uploading cover...')
        const coverResult = await uploadAsset(patternId, 'cover', cover)
        if (!coverResult.ok) completionMessage = `Pattern attached, but the cover failed: ${coverResult.message}`
      }

      onChange([...selected, { id: patternId, title: upload.title.trim(), sourceUrl: upload.sourceUrl.trim() || null, patternType: 'pdf', hasPdf: true }])
      resetUpload()
      setUploading(false)
      setStatus(completionMessage)
      closeModal(false)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unexpected pattern upload error.')
      setUploading(false)
    }
  }

  const open = (next: 'choose' | 'upload') => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setStatus('')
    setModal(next)
  }

  const resetUpload = () => {
    setUpload({ title: '', description: '', sourceUrl: '' })
    setPdf(null)
    setCover(null)
    setDraftPatternId(null)
  }

  const discardDraft = async () => {
    if (!draftPatternId) return true
    try {
      const response = await fetch('/api/scan/inventory', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'patterns', itemId: draftPatternId }) })
      const payload = await response.json().catch(() => ({})) as { message?: string }
      if (!response.ok) {
        setStatus(payload.message ?? 'Could not remove the incomplete pattern. Retry closing the dialog.')
        return false
      }
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not remove the incomplete pattern. Retry closing the dialog.')
      return false
    }
  }

  const closeModal = async (discard = true) => {
    if (discard && draftPatternId) {
      setUploading(true)
      setStatus('Removing incomplete pattern...')
      const removed = await discardDraft()
      setUploading(false)
      if (!removed) return
      resetUpload()
    }
    setModal(null)
    window.setTimeout(() => restoreFocusRef.current?.focus(), 0)
  }

  const switchToChoose = async () => {
    if (draftPatternId) {
      setUploading(true)
      setStatus('Removing incomplete pattern...')
      const removed = await discardDraft()
      setUploading(false)
      if (!removed) return
      resetUpload()
    } else {
      resetUpload()
    }
    setStatus('')
    setModal('choose')
  }

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLInputElement
    if (event.key === 'Enter' && target.tagName === 'INPUT' && target.type !== 'file') event.preventDefault()
    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]') ?? [])
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return <div className="project-pattern-picker">
    <div className="project-pattern-picker-head"><span>Patterns</span><div><button className="button" onClick={() => open('choose')} type="button"><Search size={14} /> Choose existing</button><button className="button" onClick={() => open('upload')} type="button"><Upload size={14} /> Upload new</button></div></div>
    {selected.length ? <div className="project-selected-patterns">{selected.map((pattern) => <span key={pattern.id}><a href={patternViewerHref(pattern, projectId)}>{pattern.title}</a><button aria-label={`Remove ${pattern.title}`} onClick={() => togglePattern(pattern)} type="button"><X size={12} /></button></span>)}</div> : <p>No patterns attached.</p>}
    {!modal && status ? <p className="form-status" role="status">{status}</p> : null}

    {modal && typeof document !== 'undefined' ? createPortal(<div className="modal-backdrop" role="presentation">
      <div aria-label={modal === 'choose' ? 'Choose patterns' : 'Upload a pattern'} aria-modal="true" className="community-modal project-pattern-modal" onKeyDown={handleDialogKeyDown} ref={dialogRef} role="dialog">
        <div className="community-modal-head"><div><span className="kicker">{modal === 'choose' ? 'Pattern library' : 'New inventory pattern'}</span><h2>{modal === 'choose' ? 'Choose existing patterns' : 'Upload and attach a pattern'}</h2></div><button aria-label="Close pattern dialog" className="button" disabled={uploading} onClick={() => void closeModal()} type="button"><X size={16} /></button></div>
        {modal === 'choose' ? <>
          <label className="project-pattern-search"><Search size={15} /><input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Search your pattern title, notes, or difficulty..." type="search" value={query} /></label>
          <div className="project-pattern-results">
            {searching ? <p>Searching patterns...</p> : null}
            {!searching && !results.length ? <div className="project-pattern-empty"><p>{query ? 'No matching patterns.' : 'No patterns in your inventory yet.'}</p><button className="button button-primary" onClick={() => setModal('upload')} type="button"><Upload size={14} /> Upload a pattern</button></div> : null}
            {!searching ? results.slice(0, 60).map((pattern) => {
              const attached = selected.some((item) => item.id === pattern.id)
              return <button aria-pressed={attached} className="project-pattern-result" key={pattern.id} onClick={() => togglePattern(pattern)} type="button"><span className="project-pattern-result-icon"><FilePlus2 size={18} /></span><span><strong>{pattern.title}</strong><small>{pattern.isLinked && pattern.ownerDisplayName ? `By ${pattern.ownerDisplayName}` : pattern.hasPdf ? 'Uploaded PDF' : pattern.patternType}</small></span><span>{attached ? <><Check size={13} /> Attached</> : <><Plus size={13} /> Add</>}</span></button>
            }) : null}
            {results.length > 60 ? <p className="project-pattern-result-limit">Showing the first 60 results. Refine your search to narrow the list.</p> : null}
          </div>
          {status ? <p className="form-status" role="status">{status}</p> : null}
          <div className="project-pattern-modal-actions"><span>{selected.length} attached</span><button className="button button-primary" onClick={() => void closeModal(false)} type="button">Done</button></div>
        </> : <div className="stack-form project-pattern-upload">
          <label>Pattern title<input autoFocus maxLength={200} onChange={(event) => setUpload({ ...upload, title: event.target.value })} value={upload.title} /></label>
          <label>Source URL<input onChange={(event) => setUpload({ ...upload, sourceUrl: event.target.value })} placeholder="https://..." type="url" value={upload.sourceUrl} /></label>
          <label>Description<textarea onChange={(event) => setUpload({ ...upload, description: event.target.value })} rows={3} value={upload.description} /></label>
          <div className="project-pattern-upload-field"><span>Pattern PDF</span><FileDropInput accept="application/pdf,.pdf" hint="Choose or drop a PDF (40MB maximum)" onSelect={(files) => setPdf(files[0] ?? null)} /></div>
          <div className="project-pattern-upload-field"><span>Cover image <span className="muted">optional</span></span><FileDropInput accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" hint="Optional cover; otherwise one is generated" onSelect={(files) => setCover(files[0] ?? null)} /></div>
          {status ? <p className="form-status" role="status">{status}</p> : null}
          <div className="project-pattern-modal-actions"><button className="button" disabled={uploading} onClick={() => void switchToChoose()} type="button">Choose existing instead</button><button className="button button-primary" disabled={uploading} onClick={() => void uploadPattern()} type="button"><Upload size={14} /> {uploading ? 'Uploading...' : draftPatternId ? 'Retry upload' : 'Upload and attach'}</button></div>
        </div>}
      </div>
    </div>, document.body) : null}
  </div>
}

async function uploadAsset(patternId: string, kind: 'pdf' | 'cover', file: File) {
  let preparedKey: string | null = null
  try {
    const prepareResponse = await fetch(`/api/patterns/${patternId}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, fileName: file.name, mimeType: file.type, byteSize: file.size, languageCode: 'en-US' }),
    })
    const prepared = await prepareResponse.json().catch(() => ({})) as { uploadUrl?: string; key?: string; contentType?: string; languageCode?: string; message?: string }
    if (!prepareResponse.ok || !prepared.uploadUrl || !prepared.key || !prepared.contentType) return { ok: false, message: prepared.message ?? `Could not prepare ${kind} upload.` }
    preparedKey = prepared.key
    const uploadResponse = await fetch(prepared.uploadUrl, { method: 'PUT', headers: { 'Content-Type': prepared.contentType }, body: file })
    if (!uploadResponse.ok) return { ok: false, message: `Storage upload failed with HTTP ${uploadResponse.status}.` }
    const attachResponse = await fetch(`/api/patterns/${patternId}/attach-upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, key: prepared.key, fileName: file.name, languageCode: prepared.languageCode }) })
    const attached = await attachResponse.json().catch(() => ({})) as { message?: string }
    if (!attachResponse.ok) await discardUpload(patternId, prepared.key)
    return { ok: attachResponse.ok, message: attached.message ?? (attachResponse.ok ? `${kind} uploaded.` : `Could not attach ${kind}.`) }
  } catch (error) {
    if (preparedKey) void discardUploadAfterDelay(patternId, preparedKey)
    return { ok: false, message: error instanceof Error ? error.message : `Unexpected ${kind} upload error.` }
  }
}

async function discardUpload(patternId: string, key: string) {
  await fetch(`/api/patterns/${patternId}/discard-upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) }).catch(() => null)
}

async function discardUploadAfterDelay(patternId: string, key: string) {
  await new Promise((resolve) => window.setTimeout(resolve, 3000))
  await discardUpload(patternId, key)
}

export function patternViewerHref(pattern: ProjectPatternChoice, projectId?: string) {
  const path = pattern.patternType === 'native' ? `/pattern/${pattern.id}/preview` : pattern.hasPdf ? `/pattern/${pattern.id}/reader` : `/pattern/${pattern.id}`
  return projectId ? `${path}?projectId=${encodeURIComponent(projectId)}` : path
}
