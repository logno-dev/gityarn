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

type ShareOptionsPayload = {
  creations: Array<{ id: string; name: string; status: string; updatedAt: number }>
}

function ShareIntakePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [draft, setDraft] = useState<DraftPayload['draft'] | null>(null)
  const [target, setTarget] = useState<'post' | 'creation' | 'pattern'>('post')
  const [creationMode, setCreationMode] = useState<'new' | 'existing'>('new')
  const [creationOptions, setCreationOptions] = useState<ShareOptionsPayload['creations']>([])
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [patternTitle, setPatternTitle] = useState('')
  const [patternDescription, setPatternDescription] = useState('')
  const [patternSourceUrl, setPatternSourceUrl] = useState('')
  const [patternNotes, setPatternNotes] = useState('')
  const [existingCreationId, setExistingCreationId] = useState('')
  const [creationName, setCreationName] = useState('')
  const [creationStatus, setCreationStatus] = useState('active')
  const [creationNotes, setCreationNotes] = useState('')
  const [uploading, setUploading] = useState(false)

  const draftId = useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return new URLSearchParams(window.location.search).get('draftId')?.trim() ?? ''
  }, [])

  const incomingError = useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return new URLSearchParams(window.location.search).get('error')?.trim() ?? ''
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
        setPostTitle(payload.draft.title ?? '')
        setPostBody(payload.draft.text ?? payload.draft.url ?? '')
        setPatternTitle(payload.draft.title ?? '')
        setPatternDescription(payload.draft.text ?? '')
        setPatternSourceUrl(payload.draft.url ?? '')
        setPatternNotes(payload.draft.text ?? '')
        setCreationName(payload.draft.title ?? 'Shared creation')
        setCreationNotes(payload.draft.text ?? payload.draft.url ?? '')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load shared content.')
      })
      .finally(() => setLoading(false))
  }, [draftId])

  useEffect(() => {
    fetch('/api/share/options')
      .then(async (response) => {
        const payload = (await response.json()) as ShareOptionsPayload & { message?: string }
        if (!response.ok) {
          throw new Error(payload.message ?? 'Could not load share options.')
        }
        return payload
      })
      .then((payload) => {
        setCreationOptions(payload.creations)
      })
      .catch(() => setCreationOptions([]))
  }, [])

  const importAs = async (target: 'post' | 'creation' | 'pattern') => {
    if (!draft) {
      return
    }
    setSaving(true)
    const response = await fetch('/api/share/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: draft.id,
        target,
        postTitle,
        postBody,
        patternTitle,
        patternDescription,
        patternSourceUrl,
        patternNotes,
        creationMode,
        existingCreationId,
        creationName,
        creationStatus,
        creationNotes,
      }),
    })
    const payload = (await response.json()) as { message?: string; nextPath?: string }
    setStatus(payload.message ?? (response.ok ? 'Shared content imported.' : 'Could not import shared content.'))
    setSaving(false)
    if (response.ok && payload.nextPath) {
      await navigate({ to: payload.nextPath as any })
    }
  }

  const uploadAdditionalFile = async (file: File) => {
    if (!draft) return
    setUploading(true)

    const urlResponse = await fetch('/api/share/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: draft.id,
        fileName: file.name,
        mimeType: file.type,
      }),
    })
    const urlPayload = (await urlResponse.json()) as { message?: string; uploadUrl?: string; key?: string; mimeType?: string; originalFileName?: string }
    if (!urlResponse.ok || !urlPayload.uploadUrl || !urlPayload.key || !urlPayload.mimeType) {
      setStatus(urlPayload.message ?? 'Could not prepare upload URL.')
      setUploading(false)
      return
    }

    const uploadResponse = await fetch(urlPayload.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': urlPayload.mimeType,
      },
      body: file,
    })
    if (!uploadResponse.ok) {
      setStatus('Upload failed. Please try a smaller file or better connection.')
      setUploading(false)
      return
    }

    const attachResponse = await fetch('/api/share/attach-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: draft.id,
        key: urlPayload.key,
        mimeType: urlPayload.mimeType,
        originalFileName: urlPayload.originalFileName ?? file.name,
      }),
    })
    const attachPayload = (await attachResponse.json()) as { message?: string }
    if (!attachResponse.ok) {
      setStatus(attachPayload.message ?? 'Could not attach uploaded file to draft.')
      setUploading(false)
      return
    }

    await fetch(`/api/share/draft?draftId=${encodeURIComponent(draft.id)}`)
      .then((response) => response.json())
      .then((payload: DraftPayload) => setDraft(payload.draft))

    setUploading(false)
    setStatus('File uploaded and attached.')
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
        {incomingError ? (
          <p>
            The original share payload could not be imported ({incomingError.replace(/\+/g, ' ')}). If this was a large file,
            use the direct upload field below to attach it manually.
          </p>
        ) : null}

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

            <label>
              Add file to this draft (direct upload)
              <input
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void uploadAdditionalFile(file)
                  }
                  event.currentTarget.value = ''
                }}
                type="file"
              />
            </label>

            <label>
              Import target
              <select onChange={(event) => setTarget(event.target.value as 'post' | 'creation' | 'pattern')} value={target}>
                <option value="post">Post</option>
                <option value="creation">Creation</option>
                <option value="pattern">Pattern</option>
              </select>
            </label>

            {target === 'post' ? (
              <>
                <label>
                  Post title (optional)
                  <input onChange={(event) => setPostTitle(event.target.value)} type="text" value={postTitle} />
                </label>
                <label>
                  Post body
                  <textarea
                    maxLength={5000}
                    onChange={(event) => setPostBody(event.target.value)}
                    rows={5}
                    value={postBody}
                  />
                </label>
              </>
            ) : null}

            {target === 'pattern' ? (
              <>
                <label>
                  Pattern title
                  <input onChange={(event) => setPatternTitle(event.target.value)} type="text" value={patternTitle} />
                </label>
                <label>
                  Description
                  <textarea onChange={(event) => setPatternDescription(event.target.value)} rows={4} value={patternDescription} />
                </label>
                <label>
                  Source URL
                  <input onChange={(event) => setPatternSourceUrl(event.target.value)} type="text" value={patternSourceUrl} />
                </label>
                <label>
                  Notes
                  <textarea onChange={(event) => setPatternNotes(event.target.value)} rows={3} value={patternNotes} />
                </label>
              </>
            ) : null}

            {target === 'creation' ? (
              <>
                <label>
                  Creation mode
                  <select onChange={(event) => setCreationMode(event.target.value as 'new' | 'existing')} value={creationMode}>
                    <option value="new">Create new creation</option>
                    <option value="existing">Attach to existing creation</option>
                  </select>
                </label>
                {creationMode === 'existing' ? (
                  <label>
                    Existing creation
                    <select onChange={(event) => setExistingCreationId(event.target.value)} value={existingCreationId}>
                      <option value="">Select creation</option>
                      {creationOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.status})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <label>
                      New creation name
                      <input onChange={(event) => setCreationName(event.target.value)} type="text" value={creationName} />
                    </label>
                    <label>
                      Status
                      <select onChange={(event) => setCreationStatus(event.target.value)} value={creationStatus}>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                        <option value="finished">finished</option>
                      </select>
                    </label>
                    <label>
                      Notes
                      <textarea onChange={(event) => setCreationNotes(event.target.value)} rows={3} value={creationNotes} />
                    </label>
                  </>
                )}
              </>
            ) : null}

            <div className="hero-actions">
              <button className="button button-primary" disabled={saving} onClick={() => void importAs(target)} type="button">
                {target === 'post' ? <Newspaper size={14} /> : null}
                {target === 'creation' ? <Scissors size={14} /> : null}
                {target === 'pattern' ? <BookOpen size={14} /> : null}
                Import as {target.charAt(0).toUpperCase() + target.slice(1)}
              </button>
            </div>
          </div>
        ) : null}
      </article>
    </section>
  )
}
