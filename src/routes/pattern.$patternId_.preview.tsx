import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, Palette, Pencil, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { NativePatternRenderer } from '#/components/native-pattern-renderer'
import type { RenderedNativePattern } from '#/components/native-pattern-renderer'

type PreviewPayload = RenderedNativePattern & {
  pattern: RenderedNativePattern['pattern'] & {
    id: string
    canEdit: boolean
    isFinalized: boolean
  }
}

export const Route = createFileRoute('/pattern/$patternId_/preview')({ component: NativePatternPreviewPage })

function NativePatternPreviewPage() {
  const { patternId } = Route.useParams()
  const [document, setDocument] = useState<PreviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const [completedRowIds, setCompletedRowIds] = useState<Set<string>>(new Set())
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([fetch(`/api/patterns/${patternId}/native`), fetch(`/api/patterns/${patternId}/native-progress`)].map(async (request) => {
      const response = await request
      const payload = await response.json() as Record<string, unknown> & { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Could not load pattern preview.')
      return payload
    }))
      .then(([payload, progress]) => {
        const nextDocument = payload as PreviewPayload
        setDocument(nextDocument)
        setCompletedRowIds(new Set(progress.completedRowIds as string[] ?? []))
        setColorOverrides(readColorOverrides(patternId, nextDocument.colors))
      })
      .catch((nextError: unknown) => setError(nextError instanceof Error ? nextError.message : 'Could not load pattern preview.'))
      .finally(() => setLoading(false))
  }, [patternId])

  const toggleRow = async (rowId: string, completed: boolean) => {
    setCompletedRowIds((current) => {
      const next = new Set(current)
      if (completed) next.add(rowId)
      else next.delete(rowId)
      return next
    })
    const response = await fetch(`/api/patterns/${patternId}/native-progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId, completed }),
    })
    if (!response.ok) {
      setCompletedRowIds((current) => {
        const next = new Set(current)
        if (completed) next.delete(rowId)
        else next.add(rowId)
        return next
      })
      setError('Could not save row progress.')
    }
  }

  const toggleFinalized = async () => {
    if (!document) return
    const nextFinalized = !document.pattern.isFinalized
    setFinalizing(true)
    setError('')
    try {
      const response = await fetch(`/api/patterns/${patternId}/native`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFinalized: nextFinalized }),
      })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Could not update pattern status.')
      setDocument({ ...document, pattern: { ...document.pattern, isFinalized: nextFinalized } })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update pattern status.')
    } finally {
      setFinalizing(false)
    }
  }

  const changeColor = (colorId: string, color: string) => {
    if (!document || !/^#[0-9A-F]{6}$/i.test(color)) return
    setColorOverrides((current) => {
      const next = { ...current }
      const authoredColor = document.colors.find((item) => item.id === colorId)?.hexColor ?? '#C78AA8'
      if (color.toUpperCase() === authoredColor.toUpperCase()) delete next[colorId]
      else next[colorId] = color.toUpperCase()
      writeColorOverrides(patternId, next)
      return next
    })
  }

  const resetColors = () => {
    setColorOverrides({})
    writeColorOverrides(patternId, {})
  }

  if (loading) return <p>Loading pattern preview...</p>
  if (!document) return <p>{error || 'Pattern unavailable.'}</p>

  return <section className="native-preview-page">
    <header className="native-preview-toolbar">
      <Link className="button" params={{ patternId }} to="/pattern/$patternId"><ArrowLeft size={16} /> Pattern details</Link>
      <div><span className="kicker">{document.pattern.isFinalized ? 'Private interactive pattern' : 'Private preview'}</span><strong>{document.pattern.title}</strong></div>
      {document.pattern.canEdit ? <div className="native-preview-actions">
        <a className="button" href={`/pattern/${patternId}/edit`}><Pencil size={15} /> Edit</a>
        <a className="button" href={`/pattern/${patternId}/design`}><Palette size={15} /> Design</a>
        <button className="button button-primary" disabled={finalizing} onClick={() => void toggleFinalized()} type="button">{document.pattern.isFinalized ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />} {finalizing ? 'Updating...' : document.pattern.isFinalized ? 'Reopen for editing' : 'Finalize private pattern'}</button>
      </div> : null}
    </header>
    {error ? <p className="native-preview-error">{error}</p> : null}
    <NativePatternRenderer colorOverrides={colorOverrides} completedRowIds={completedRowIds} document={document} onColorChange={changeColor} onResetColors={resetColors} onToggleRow={(rowId, completed) => void toggleRow(rowId, completed)} />
  </section>
}

function readColorOverrides(patternId: string, colors: RenderedNativePattern['colors']) {
  try {
    const stored = JSON.parse(localStorage.getItem(colorStorageKey(patternId)) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(colors.flatMap((color) => {
      const value = stored[color.id]
      return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value) ? [[color.id, value.toUpperCase()]] : []
    }))
  } catch {
    return {}
  }
}

function writeColorOverrides(patternId: string, colors: Record<string, string>) {
  try {
    if (Object.keys(colors).length) localStorage.setItem(colorStorageKey(patternId), JSON.stringify(colors))
    else localStorage.removeItem(colorStorageKey(patternId))
  } catch {
    // Color changes still work for the current session when storage is unavailable.
  }
}

function colorStorageKey(patternId: string) {
  return `native-pattern-colors:${patternId}`
}
