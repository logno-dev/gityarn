import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, CirclePlus, Image, MessageSquareText, Palette, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { FileDropInput } from '#/components/file-drop-input'
import type { NativeBlockStyle, NativePatternStyle } from '#/lib/patterns/native-document'
import type { NativeSectionType } from '#/lib/patterns/native-layout'
import { parsePatternStep } from '#/lib/patterns/native-parser'

type NativeColor = {
  id: string
  key: string
  label: string
  hexColor: string | null
}

type NativeRow = {
  id: string
  blockType: 'row' | 'note' | 'image' | 'text'
  rowType: 'chain' | 'magic-ring' | 'row' | 'round'
  instruction: string
  colorKey: string | null
  imageR2Key?: string | null
  imageMimeType?: string | null
  imageByteSize?: number | null
  imageAltText?: string | null
  imageCaption?: string | null
  imageSrc?: string | null
  blockHeading?: string | null
  designStyle?: NativeBlockStyle
}

type NativeSection = {
  id: string
  sectionType: NativeSectionType
  title: string
  notes: string | null
  designStyle?: NativeBlockStyle
  rows: NativeRow[]
}

type NativePatternPayload = {
  pattern: { id: string; title: string; description: string | null; difficulty: string | null; coverSrc: string | null; style: NativePatternStyle; isFinalized: boolean }
  colors: NativeColor[]
  sections: NativeSection[]
}

export const Route = createFileRoute('/pattern/$patternId_/edit')({ component: NativePatternEditorPage })

function NativePatternEditorPage() {
  const { patternId } = Route.useParams()
  const [document, setDocument] = useState<NativePatternPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [pendingFocusRowId, setPendingFocusRowId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/patterns/${patternId}/native`)
      .then(async (response) => {
        const payload = await response.json() as NativePatternPayload & { message?: string }
        if (!response.ok) throw new Error(payload.message ?? 'Could not load native pattern.')
        return payload
      })
      .then((payload) => {
        if (!cancelled) setDocument(payload)
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : 'Could not load native pattern.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patternId])

  useEffect(() => {
    if (!pendingFocusRowId) return
    const frame = window.requestAnimationFrame(() => {
      const input = window.document.querySelector<HTMLInputElement>(`[data-native-row-id="${pendingFocusRowId}"]`)
      input?.focus()
      setPendingFocusRowId(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [document, pendingFocusRowId])

  const save = async () => {
    if (!document) return false
    setSaving(true)
    setStatus('Saving...')
    try {
      const response = await fetch(`/api/patterns/${patternId}/native`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...document.pattern, colors: document.colors, sections: document.sections }),
      })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Could not save pattern.')
      setStatus('All changes saved.')
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save pattern.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const updateSection = (sectionId: string, update: Partial<NativeSection>) => {
    setDocument((current) => current ? { ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, ...update } : section) } : current)
  }

  const updateRow = (sectionId: string, rowId: string, update: Partial<NativeRow>) => {
    setDocument((current) => current ? {
      ...current,
      sections: current.sections.map((section) => section.id === sectionId
        ? { ...section, rows: section.rows.map((row) => row.id === rowId ? { ...row, ...update } : row) }
        : section),
    } : current)
  }

  const addRow = (sectionId: string, afterRowId?: string) => {
    const rowId = crypto.randomUUID()
    setDocument((current) => {
      if (!current) return current
      return {
        ...current,
        sections: current.sections.map((section) => {
          if (section.id !== sectionId) return section
          const afterIndex = afterRowId ? section.rows.findIndex((row) => row.id === afterRowId) : section.rows.length - 1
          const insertIndex = afterIndex >= 0 ? afterIndex + 1 : section.rows.length
          const previous = section.rows[Math.max(0, insertIndex - 1)]
          const nextRow: NativeRow = {
            id: rowId,
            blockType: 'row',
            rowType: previous?.rowType === 'chain' ? 'row' : previous?.rowType === 'magic-ring' ? 'round' : previous?.rowType ?? 'round',
            instruction: '',
            colorKey: previous?.colorKey ?? current.colors[0]?.key ?? null,
          }
          return { ...section, rows: [...section.rows.slice(0, insertIndex), nextRow, ...section.rows.slice(insertIndex)] }
        }),
      }
    })
    setPendingFocusRowId(rowId)
  }

  const addBlock = (sectionId: string, blockType: 'note' | 'image') => {
    setDocument((current) => current ? {
      ...current,
      sections: current.sections.map((section) => section.id === sectionId ? {
        ...section,
        rows: [...section.rows, { id: crypto.randomUUID(), blockType, rowType: 'round', instruction: '', colorKey: null }],
      } : section),
    } : current)
  }

  const uploadTitleImage = async (file: File) => {
    if (!document) return
    setStatus('Uploading title image...')
    const formData = new FormData()
    formData.set('kind', 'cover')
    formData.set('file', file)
    try {
      const response = await fetch(`/api/patterns/${patternId}/upload`, { method: 'POST', body: formData })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Could not upload title image.')
      setDocument((current) => current ? { ...current, pattern: { ...current.pattern, coverSrc: `/api/patterns/${patternId}/cover?t=${Date.now()}` } } : current)
      setStatus('Title image uploaded.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not upload title image.')
    }
  }

  const uploadBlockImage = async (sectionId: string, blockId: string, file: File) => {
    setStatus('Uploading image block...')
    const formData = new FormData()
    formData.set('file', file)
    try {
      const response = await fetch(`/api/patterns/${patternId}/native-images`, { method: 'POST', body: formData })
      const payload = await response.json() as { image?: { r2Key: string; mimeType: string; byteSize: number }; message?: string }
      if (!response.ok || !payload.image) throw new Error(payload.message ?? 'Could not upload image.')
      updateRow(sectionId, blockId, {
        imageR2Key: payload.image.r2Key,
        imageMimeType: payload.image.mimeType,
        imageByteSize: payload.image.byteSize,
        imageSrc: URL.createObjectURL(file),
      })
      setStatus('Image uploaded. Save the pattern to keep this block.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not upload image.')
    }
  }

  const addSection = () => {
    const sectionId = crypto.randomUUID()
    const rowId = crypto.randomUUID()
    setDocument((current) => current ? {
      ...current,
      sections: [...current.sections, {
        id: sectionId,
        sectionType: 'pattern',
        title: `Section ${current.sections.length + 1}`,
        notes: null,
        rows: [{ id: rowId, blockType: 'row', rowType: 'round', instruction: '', colorKey: current.colors[0]?.key ?? null }],
      }],
    } : current)
    setPendingFocusRowId(rowId)
  }

  let rowNumber = 0

  return (
    <section className="native-editor-page">
      <header className="native-editor-toolbar">
        <Link className="button" params={{ patternId }} to="/pattern/$patternId"><ArrowLeft size={16} /> Pattern details</Link>
        <div>
          <span className="kicker">Native pattern editor</span>
          <h1>{document?.pattern.title ?? 'Pattern'}</h1>
        </div>
        <div className="native-editor-save">
          <span aria-live="polite">{status}</span>
          <button className="button" disabled={saving || !document} onClick={async () => { if (await save()) window.location.href = `/pattern/${patternId}/design` }} type="button">Design pattern</button>
          <button className="button button-primary" disabled={saving || !document} onClick={() => void save()} type="button"><Save size={16} /> {saving ? 'Saving...' : 'Save pattern'}</button>
        </div>
      </header>

      {loading ? <p>Loading editor...</p> : null}
      {!loading && !document ? <p>{status || 'Pattern unavailable.'}</p> : null}
      {document ? (
        <main className="native-document">
          <header className="native-document-header">
            <div className="native-title-image">
              {document.pattern.coverSrc ? <img alt="Pattern title" src={document.pattern.coverSrc} /> : <div className="native-title-image-placeholder"><Image size={28} /><span>Title image</span></div>}
              <FileDropInput accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" hint={document.pattern.coverSrc ? 'Replace title image' : 'Add title image'} onSelect={(files) => { if (files[0]) void uploadTitleImage(files[0]) }} />
            </div>
            <input aria-label="Pattern title" className="native-document-title" maxLength={200} onChange={(event) => setDocument({ ...document, pattern: { ...document.pattern, title: event.target.value } })} value={document.pattern.title} />
            <input aria-label="Difficulty" className="native-document-difficulty" maxLength={100} onChange={(event) => setDocument({ ...document, pattern: { ...document.pattern, difficulty: event.target.value || null } })} placeholder="Difficulty" value={document.pattern.difficulty ?? ''} />
            <textarea aria-label="Pattern description" className="native-document-description" maxLength={5_000} onChange={(event) => setDocument({ ...document, pattern: { ...document.pattern, description: event.target.value || null } })} placeholder="Pattern description" rows={3} value={document.pattern.description ?? ''} />
          </header>

          <section className="native-colors-strip">
            <div className="native-document-subhead">
              <div><h2><Palette size={17} /> Yarn colors</h2><p>Readers can substitute these semantic colors.</p></div>
              <button className="native-quiet-action" onClick={() => setDocument({ ...document, colors: [...document.colors, { id: crypto.randomUUID(), key: `CC${document.colors.length}`, label: `Contrast Color ${document.colors.length}`, hexColor: '#C78AA8' }] })} type="button"><CirclePlus size={14} /> Add color</button>
            </div>
            <div className="native-color-list">
              {document.colors.map((color) => (
                <div className="native-color-row" key={color.id}>
                  <input aria-label={`${color.key} swatch`} onChange={(event) => setDocument({ ...document, colors: document.colors.map((item) => item.id === color.id ? { ...item, hexColor: event.target.value } : item) })} type="color" value={color.hexColor ?? '#C78AA8'} />
                  <input aria-label="Color key" maxLength={8} onChange={(event) => setDocument({ ...document, colors: document.colors.map((item) => item.id === color.id ? { ...item, key: event.target.value.toUpperCase() } : item) })} value={color.key} />
                  <input aria-label="Color label" maxLength={100} onChange={(event) => setDocument({ ...document, colors: document.colors.map((item) => item.id === color.id ? { ...item, label: event.target.value } : item) })} value={color.label} />
                  <button aria-label={`Delete ${color.key}`} className="native-icon-action" disabled={document.colors.length === 1} onClick={() => setDocument({ ...document, colors: document.colors.filter((item) => item.id !== color.id) })} type="button"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </section>

          <div className="native-section-list">
            {document.sections.map((section) => {
              if (section.sectionType !== 'pattern') return null
              const parsedRows = parseRowsInContext(section.rows)
              return <section className="native-section-block" key={section.id}>
                <div className="native-section-heading">
                  <input aria-label="Section title" maxLength={200} onChange={(event) => updateSection(section.id, { title: event.target.value })} value={section.title} />
                  <button aria-label={`Delete ${section.title}`} className="native-icon-action" disabled={document.sections.length === 1} onClick={() => setDocument({ ...document, sections: document.sections.filter((item) => item.id !== section.id) })} type="button"><Trash2 size={15} /></button>
                </div>
                <textarea className="native-section-notes" onChange={(event) => updateSection(section.id, { notes: event.target.value || null })} placeholder="Optional section notes or setup instructions" rows={2} value={section.notes ?? ''} />
                 <div className="native-row-list">
                   {section.rows.map((row, index) => {
                     if (row.blockType === 'text') return null
                     if (row.blockType === 'note') {
                       return <div className="native-content-block native-note-block" key={row.id}>
                         <MessageSquareText aria-hidden="true" size={18} />
                         <textarea aria-label="Pattern note" maxLength={10_000} onChange={(event) => updateRow(section.id, row.id, { instruction: event.target.value })} placeholder="Add a note, tip, warning, or explanation..." rows={3} value={row.instruction} />
                         <button aria-label="Delete note block" className="native-icon-action" onClick={() => updateSection(section.id, { rows: section.rows.filter((item) => item.id !== row.id) })} type="button"><Trash2 size={14} /></button>
                       </div>
                     }
                     if (row.blockType === 'image') {
                       return <div className="native-content-block native-image-block" key={row.id}>
                         <div className="native-image-block-preview">
                           {row.imageSrc ? <img alt={row.imageAltText || row.imageCaption || 'Pattern instruction'} src={row.imageSrc} /> : <div><Image size={28} /><span>No image selected</span></div>}
                         </div>
                         <div className="native-image-block-fields">
                           <FileDropInput accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" hint={row.imageSrc ? 'Replace image' : 'Choose image'} onSelect={(files) => { if (files[0]) void uploadBlockImage(section.id, row.id, files[0]) }} />
                           <input aria-label="Image caption" maxLength={1_000} onChange={(event) => updateRow(section.id, row.id, { imageCaption: event.target.value || null })} placeholder="Caption (optional)" value={row.imageCaption ?? ''} />
                           <input aria-label="Image alternative text" maxLength={500} onChange={(event) => updateRow(section.id, row.id, { imageAltText: event.target.value || null })} placeholder="Describe the image for screen readers" value={row.imageAltText ?? ''} />
                         </div>
                         <button aria-label="Delete image block" className="native-icon-action" onClick={() => updateSection(section.id, { rows: section.rows.filter((item) => item.id !== row.id) })} type="button"><Trash2 size={14} /></button>
                       </div>
                     }
                     if (row.rowType !== 'chain' && row.rowType !== 'magic-ring') rowNumber += 1
                    const currentNumber = rowNumber
                    const stepLabel = row.rowType === 'chain' ? 'Chain' : row.rowType === 'magic-ring' ? 'Magic ring' : `${row.rowType === 'round' ? 'R' : 'Row'} ${currentNumber}`
                     const parsed = parsedRows[index]!
                    return (
                      <div className="native-pattern-row" key={row.id}>
                        <span className="native-row-number">{stepLabel}</span>
                        <select aria-label={`Type for step ${row.rowType === 'chain' || row.rowType === 'magic-ring' ? row.rowType : currentNumber}`} onChange={(event) => updateRow(section.id, row.id, { rowType: event.target.value === 'chain' ? 'chain' : event.target.value === 'magic-ring' ? 'magic-ring' : event.target.value === 'row' ? 'row' : 'round' })} value={row.rowType}><option value="chain">Chain</option><option value="magic-ring">Magic ring / circle</option><option value="round">Round</option><option value="row">Row</option></select>
                        <select aria-label={`Color for row ${currentNumber}`} onChange={(event) => updateRow(section.id, row.id, { colorKey: event.target.value || null })} value={row.colorKey ?? ''}><option value="">No color</option>{document.colors.map((color) => <option key={color.id} value={color.key}>{color.key}</option>)}</select>
                        {row.rowType === 'chain' ? (
                          <input
                            aria-label={`Instructions for ${stepLabel}`}
                            data-native-row-id={row.id}
                            inputMode="numeric"
                            min={1}
                            onChange={(event) => updateRow(section.id, row.id, { instruction: event.target.value })}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
                                event.preventDefault()
                                addRow(section.id, row.id)
                              }
                            }}
                            placeholder="21"
                            type="number"
                            value={row.instruction}
                          />
                        ) : (
                          <PatternInstructionInput
                            label={`Instructions for ${stepLabel}`}
                            onAdvance={() => addRow(section.id, row.id)}
                            onChange={(instruction) => updateRow(section.id, row.id, { instruction })}
                            placeholder={row.rowType === 'magic-ring' ? '6 sc' : '(2 sc, inc) x 6'}
                            rowId={row.id}
                            value={row.instruction}
                          />
                        )}
                        <span className={`native-row-count ${parsed.warning ? 'warning' : ''}`} title={parsed.warning ?? undefined}>{parsed.stitchCount === null ? '—' : `[${parsed.stitchCount}]`}</span>
                        <button aria-label={`Delete ${stepLabel}`} className="native-icon-action native-row-delete" onClick={() => updateSection(section.id, { rows: section.rows.filter((item) => item.id !== row.id) })} type="button"><Trash2 size={14} /></button>
                      </div>
                    )
                  })}
                </div>
                 <div className="native-block-actions">
                   <button className="native-quiet-action native-add-row" onClick={() => addRow(section.id)} type="button"><CirclePlus size={14} /> Add step</button>
                   <button className="native-quiet-action" onClick={() => addBlock(section.id, 'note')} type="button"><MessageSquareText size={14} /> Add note</button>
                   <button className="native-quiet-action" onClick={() => addBlock(section.id, 'image')} type="button"><Image size={14} /> Add image</button>
                 </div>
              </section>
            })}
          </div>
          <button className="native-add-section" onClick={addSection} type="button"><CirclePlus size={15} /> Add section</button>
        </main>
      ) : null}
    </section>
  )
}

function parseRowsInContext(rows: NativeRow[]) {
  let previousStitchCount: number | null = null
  return rows.map((row) => {
    if (row.blockType !== 'row') return null
    const parsed = parsePatternStep(row.rowType, row.instruction, previousStitchCount)
    previousStitchCount = parsed.stitchCount
    return parsed
  })
}

const stitchSuggestions = [
  { value: 'sc', label: 'single crochet' },
  { value: 'hdc', label: 'half double crochet' },
  { value: 'dc', label: 'double crochet' },
  { value: 'tr', label: 'treble crochet' },
  { value: 'sl st', label: 'slip stitch' },
  { value: 'inc', label: 'increase' },
  { value: 'dec', label: 'decrease' },
  { value: 'ch', label: 'chain' },
]

function PatternInstructionInput({ label, onAdvance, onChange, placeholder, rowId, value }: {
  label: string
  onAdvance: () => void
  onChange: (value: string) => void
  placeholder: string
  rowId: string
  value: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [caret, setCaret] = useState(value.length)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const completion = getCompletion(value, caret)
  const suggestions = focused && completion
    ? stitchSuggestions.filter((stitch) => stitch.value.startsWith(completion.query) || stitch.label.startsWith(completion.query))
    : []

  const replaceSelection = (text: string, caretOffset = text.length) => {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? start
    const nextValue = value.slice(0, start) + text + value.slice(end)
    const nextCaret = start + caretOffset
    onChange(nextValue)
    setCaret(nextCaret)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const acceptSuggestion = (suggestion = suggestions[activeSuggestion]) => {
    if (!suggestion || !completion) return
    let prefix = value.slice(0, completion.start)
    if (/[a-z)]\s+$/i.test(prefix)) prefix = prefix.replace(/\s+$/, ', ')
    const trailingSpace = value.slice(caret).startsWith(',') ? '' : ' '
    const nextValue = prefix + suggestion.value + trailingSpace + value.slice(caret)
    const nextCaret = prefix.length + suggestion.value.length + trailingSpace.length
    onChange(nextValue)
    setCaret(nextCaret)
    setActiveSuggestion(0)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const insertParentheses = () => {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? start
    const selection = value.slice(start, end)
    replaceSelection(`(${selection})`, selection.length + 1)
  }

  const closeParenthesis = () => {
    const input = inputRef.current
    const position = input?.selectionStart ?? value.length
    const prefix = value.slice(0, position).replace(/[,\s]+$/, '')
    if (value[position] === ')') {
      const nextValue = prefix + value.slice(position)
      const nextCaret = prefix.length + 1
      if (nextValue !== value) onChange(nextValue)
      setCaret(nextCaret)
      window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(nextCaret, nextCaret))
      return
    }
    const nextValue = prefix + ')' + value.slice(input?.selectionEnd ?? position)
    const nextCaret = prefix.length + 1
    onChange(nextValue)
    setCaret(nextCaret)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const insertRepeat = () => {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? start
    const prefix = value.slice(0, start).replace(/[,\s]+$/, '')
    const nextValue = prefix + ' x ' + value.slice(end)
    const nextCaret = prefix.length + 3
    onChange(nextValue)
    setCaret(nextCaret)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  return (
    <div className="notation-input">
      <input
        aria-autocomplete="list"
        aria-controls={`${rowId}-stitches`}
        aria-expanded={suggestions.length > 0}
        aria-label={label}
        autoCapitalize="off"
        autoComplete="off"
        data-native-row-id={rowId}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          onChange(event.target.value)
          setCaret(event.target.selectionStart ?? event.target.value.length)
          setActiveSuggestion(0)
        }}
        onClick={(event) => setCaret(event.currentTarget.selectionStart ?? value.length)}
        onFocus={(event) => {
          setFocused(true)
          setCaret(event.currentTarget.selectionStart ?? value.length)
        }}
        onKeyDown={(event) => {
          const shortcutKey = !event.metaKey && !event.ctrlKey && !event.altKey ? event.key : ''
          if (suggestions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            setActiveSuggestion((current) => (current + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length)
            return
          }
          if (suggestions.length && (event.key === 'Enter' || event.key === 'Tab')) {
            event.preventDefault()
            acceptSuggestion()
            return
          }
          if (event.key === 'Escape' && suggestions.length) {
            event.preventDefault()
            setFocused(false)
            return
          }
          if (event.key === '(') {
            event.preventDefault()
            insertParentheses()
            return
          }
          if (shortcutKey === '[') {
            event.preventDefault()
            insertParentheses()
            return
          }
          if (event.key === ')' || shortcutKey === ']') {
            event.preventDefault()
            closeParenthesis()
            return
          }
          if (event.key === ',' || shortcutKey === ';') {
            event.preventDefault()
            replaceSelection(value[(inputRef.current?.selectionStart ?? 0) - 1] === ',' ? ' ' : ', ')
            return
          }
          if (shortcutKey === '=') {
            event.preventDefault()
            insertRepeat()
            return
          }
          if (event.key === 'Tab' && value[inputRef.current?.selectionStart ?? value.length] === ')') {
            event.preventDefault()
            closeParenthesis()
            return
          }
          if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
            event.preventDefault()
            onAdvance()
          }
        }}
        placeholder={placeholder}
        ref={inputRef}
        role="combobox"
        spellCheck={false}
        value={value}
      />
      {focused ? (
        <div aria-label="Notation shortcuts" className="notation-shortcuts">
          <button onMouseDown={(event) => event.preventDefault()} onClick={insertParentheses} title="Wrap selection or insert a pair ([)" type="button">(…) <kbd>[</kbd></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={closeParenthesis} title="Close group (])" type="button">) <kbd>]</kbd></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => replaceSelection(', ')} title="Next stitch (;)" type="button">, <kbd>;</kbd></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={insertRepeat} title="Repeat group (=)" type="button">× repeat <kbd>=</kbd></button>
        </div>
      ) : null}
      {suggestions.length ? (
        <div className="notation-suggestions" id={`${rowId}-stitches`} role="listbox">
          {suggestions.map((suggestion, index) => (
            <button
              aria-selected={index === activeSuggestion}
              className={index === activeSuggestion ? 'active' : ''}
              key={suggestion.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => acceptSuggestion(suggestion)}
              role="option"
              type="button"
            ><strong>{suggestion.value}</strong><span>{suggestion.label}</span></button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function getCompletion(value: string, caret: number) {
  const beforeCaret = value.slice(0, caret)
  const match = beforeCaret.match(/([a-z]+)$/i)
  const query = match?.[1]?.toLowerCase()
  if (!match || !query) return null
  return { query, start: caret - match[1].length }
}
