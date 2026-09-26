import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, Eye, GripVertical, Heading2, Image as ImageIcon, MessageSquareText, Minus, Move, Save, Space, Trash2, Type } from 'lucide-react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, DragEvent as ReactDragEvent, ReactNode } from 'react'
import type { Layout } from 'react-grid-layout'

import { FileDropInput } from '#/components/file-drop-input'
import { NativePatternBackground, NativePatternWidgetContent } from '#/components/native-pattern-renderer'
import { defaultNativeBlockStyle } from '#/lib/patterns/native-document'
import type { NativeBlockStyle, NativePatternStyle } from '#/lib/patterns/native-document'
import { heroBackgroundStyle, nativeBackgroundPatternOptions } from '#/lib/patterns/hero-backgrounds'
import { defaultWidgetHeight, mergeNativeGridPositions, reconcileNativeGridLayout } from '#/lib/patterns/native-layout'
import type { NativeGridItem, NativeSectionType, NativeWidgetKind } from '#/lib/patterns/native-layout'
import { createNativeGridCompactor } from '#/lib/patterns/native-grid-compactor'
import type { NativeGridInteraction } from '#/lib/patterns/native-grid-compactor'

type DesignBlock = {
  id: string
  blockType: 'row' | 'note' | 'image' | 'text'
  rowType: 'chain' | 'magic-ring' | 'row' | 'round'
  instruction: string
  colorKey: string | null
  computedStitchCount: number | null
  imageR2Key?: string | null
  imageMimeType?: string | null
  imageByteSize?: number | null
  imageAltText?: string | null
  imageCaption?: string | null
  imageSrc?: string | null
  blockHeading?: string | null
  designStyle?: NativeBlockStyle
}

type DesignSection = {
  id: string
  sectionType: NativeSectionType
  title: string
  notes: string | null
  designStyle?: NativeBlockStyle
  rows: DesignBlock[]
}

type DesignDocument = {
  pattern: {
    id: string
    title: string
    description: string | null
    difficulty: string | null
    coverSrc: string | null
    style: NativePatternStyle
    canEdit: boolean
  }
  colors: Array<{ id: string; key: string; label: string; hexColor: string | null }>
  sections: DesignSection[]
}

type Selection = { kind: 'page' } | { kind: 'builtin'; widgetId: 'cover' | 'palette' } | { kind: 'section'; sectionId: string } | { kind: 'block'; sectionId: string; blockId: string }
type ContentSelection = Extract<Selection, { kind: 'section' | 'block' }>

export const Route = createFileRoute('/pattern/$patternId_/design')({ component: NativePatternDesignPage })

function NativePatternDesignPage() {
  const { patternId } = Route.useParams()
  const [document, setDocument] = useState<DesignDocument | null>(null)
  const [selection, setSelection] = useState<Selection>({ kind: 'page' })
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const draggedWidgetKindRef = useRef<NativeWidgetKind | null>(null)
  const [draggingOverGrid, setDraggingOverGrid] = useState(false)
  const [drawerPreview, setDrawerPreview] = useState<NativeGridItem | null>(null)
  const [pendingWidgetId, setPendingWidgetId] = useState<string | null>(null)
  const gridInteractionRef = useRef<NativeGridInteraction | null>(null)
  const gridCompactorRef = useRef(createNativeGridCompactor(() => gridInteractionRef.current))
  const { containerRef, width: gridWidth } = useContainerWidth({ initialWidth: 960 })

  useEffect(() => {
    fetch(`/api/patterns/${patternId}/native`)
      .then(async (response) => {
        const payload = await response.json() as DesignDocument & { message?: string }
        if (!response.ok) throw new Error(payload.message ?? 'Could not load pattern design.')
        if (!payload.pattern.canEdit) throw new Error('Only the pattern owner can edit its design.')
        return payload
      })
      .then((payload) => setDocument(withGridLayout(promoteTextBlocks(payload))))
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Could not load pattern design.'))
  }, [patternId])

  useEffect(() => {
    window.document.getElementById(settingsPanelId(selection))?.scrollIntoView({ block: 'nearest' })
  }, [selection])

  useEffect(() => {
    if (!pendingWidgetId) return
    const frame = window.requestAnimationFrame(() => {
      window.document.querySelector<HTMLElement>(`[data-widget-id="${pendingWidgetId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendingWidgetId(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [document, pendingWidgetId])

  const save = async () => {
    if (!document) return false
    setSaving(true)
    setStatus('Saving design...')
    try {
      const response = await fetch(`/api/patterns/${patternId}/native`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...document.pattern, colors: document.colors, sections: document.sections }),
      })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? 'Could not save design.')
      setStatus('Design saved.')
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save design.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const updatePatternStyle = (update: Partial<NativePatternStyle>) => {
    setDocument((current) => current ? { ...current, pattern: { ...current.pattern, style: { ...current.pattern.style, ...update } } } : current)
  }

  const updateBuiltinWidgetStyle = (widgetId: 'cover' | 'palette', update: Partial<NativeBlockStyle>) => {
    setDocument((current) => {
      if (!current) return current
      const fallback = { ...defaultNativeBlockStyle, backgroundColor: current.pattern.style.backgroundColor, textColor: current.pattern.style.textColor }
      return { ...current, pattern: { ...current.pattern, style: { ...current.pattern.style, widgetStyles: { ...current.pattern.style.widgetStyles, [widgetId]: { ...(current.pattern.style.widgetStyles[widgetId] ?? fallback), ...update } } } } }
    })
  }

  const updateSection = (sectionId: string, update: Partial<DesignSection>) => {
    setDocument((current) => current ? { ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, ...update } : section) } : current)
  }

  const updateBlock = (sectionId: string, blockId: string, update: Partial<DesignBlock>) => {
    setDocument((current) => current ? { ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, rows: section.rows.map((block) => block.id === blockId ? { ...block, ...update } : block) } : section) } : current)
  }

  const addWidget = (kind: Exclude<NativeWidgetKind, 'cover' | 'palette' | 'section'> | 'section', position?: { x: number; y: number }, resolvedLayout?: NativeGridItem[]) => {
    if (!document) return
    const sectionId = crypto.randomUUID()
    const blockId = crypto.randomUUID()
    const sectionType: NativeSectionType = kind === 'section' ? 'pattern' : kind
    const rows: DesignBlock[] = kind === 'section'
      ? [{ id: blockId, blockType: 'row', rowType: 'round', instruction: 'Add row instructions in Write mode.', colorKey: document.colors[0]?.key ?? null, computedStitchCount: null }]
      : kind === 'text'
        ? [{ id: blockId, blockType: 'text', rowType: 'round', instruction: 'Add supporting text here.', blockHeading: 'New text block', colorKey: null, computedStitchCount: null, designStyle: { ...defaultNativeBlockStyle } }]
        : kind === 'image'
          ? [{ id: blockId, blockType: 'image', rowType: 'round', instruction: '', colorKey: null, computedStitchCount: null, imageR2Key: null, imageSrc: null }]
          : kind === 'note'
            ? [{ id: blockId, blockType: 'note', rowType: 'round', instruction: 'Add a helpful tip or callout.', colorKey: null, computedStitchCount: null }]
            : []
    const titles: Record<string, string> = { section: 'New pattern section', text: 'Text block', image: 'Image', note: 'Callout', heading: 'New heading', divider: 'Divider', spacer: 'Spacer' }
    const section: DesignSection = { id: sectionId, sectionType, title: titles[kind] ?? 'Widget', notes: null, designStyle: { ...defaultNativeBlockStyle }, rows }
    const currentLayout = resolvedLayout ?? reconcileNativeGridLayout(document.pattern.style.gridLayout, document.sections, document.colors.length > 0)
    const bottom = currentLayout.reduce((value, item) => Math.max(value, item.y + item.h), 0)
    const size = { w: kind === 'heading' || kind === 'divider' || kind === 'spacer' ? 12 : 6, h: defaultWidgetHeight(kind) }
    const placement = position && resolvedLayout ? position : findAvailableGridPosition(currentLayout, { x: position?.x ?? 0, y: position?.y ?? bottom, ...size })
    const item: NativeGridItem = { i: `section-${sectionId}`, kind, sectionId, ...placement, ...size, minW: 2, minH: 1 }
    setDocument({ ...document, sections: [...document.sections, section], pattern: { ...document.pattern, style: { ...document.pattern.style, gridLayout: [...currentLayout, item] } } })
    setSelection({ kind: 'section', sectionId })
    setPendingWidgetId(item.i)
    setStatus(`${titles[kind] ?? 'Component'} added to the grid.`)
  }

  const dropWidgetOnGrid = (event: ReactDragEvent<HTMLElement>) => {
    const transferredKind = event.dataTransfer.getData('application/x-gityarn-widget') || event.dataTransfer.getData('text/plain')
    const kind = drawerWidgets.find((widget) => widget.kind === transferredKind)?.kind ?? draggedWidgetKindRef.current
    if (!kind || kind === 'cover' || kind === 'palette') return
    event.preventDefault()
    event.stopPropagation()
    const preview = gridLayout.find((item) => item.i === drawerPreviewId)
    if (preview) addWidget(kind, { x: preview.x, y: preview.y }, gridLayout.filter((item) => item.i !== drawerPreviewId))
    else addWidget(kind, gridDropPosition(event, kind))
    draggedWidgetKindRef.current = null
    gridInteractionRef.current = null
    setDrawerPreview(null)
    setDraggingOverGrid(false)
  }

  const previewDrawerWidget = (event: ReactDragEvent<HTMLElement>) => {
    const kind = draggedWidgetKindRef.current
    if (!document || !kind || kind === 'cover' || kind === 'palette') return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    const size = { w: kind === 'heading' || kind === 'divider' || kind === 'spacer' ? 12 : 6, h: defaultWidgetHeight(kind) }
    const position = gridDropPosition(event, kind)
    const baseline = gridInteractionRef.current?.external
      ? gridInteractionRef.current.baseline
      : reconcileNativeGridLayout(document.pattern.style.gridLayout, document.sections, document.colors.length > 0)
    gridInteractionRef.current = { activeId: drawerPreviewId, baseline, original: null, external: true }
    setDrawerPreview((current) => current && current.kind === kind && current.x === position.x && current.y === position.y
      ? current
      : { i: drawerPreviewId, kind, sectionId: null, ...position, ...size, minW: 2, minH: 1 })
    setDraggingOverGrid(true)
  }

  const updateGridLayout = (layout: Layout) => {
    if (gridInteractionRef.current?.external) return
    setDocument((current) => {
      if (!current) return current
      const gridLayout = mergeNativeGridPositions(current.pattern.style.gridLayout, layout)
      if (sameGridLayout(current.pattern.style.gridLayout, gridLayout)) return current
      return { ...current, pattern: { ...current.pattern, style: { ...current.pattern.style, gridLayout } } }
    })
  }

  const uploadBlockImage = async (sectionId: string, blockId: string, file: File) => {
    setStatus('Uploading image...')
    const formData = new FormData()
    formData.set('file', file)
    try {
      const response = await fetch(`/api/patterns/${patternId}/native-images`, { method: 'POST', body: formData })
      const payload = await response.json() as { image?: { r2Key: string; mimeType: string; byteSize: number }; message?: string }
      if (!response.ok || !payload.image) throw new Error(payload.message ?? 'Could not upload image.')
      updateBlock(sectionId, blockId, { imageR2Key: payload.image.r2Key, imageMimeType: payload.image.mimeType, imageByteSize: payload.image.byteSize, imageSrc: URL.createObjectURL(file) })
      setStatus('Image uploaded. Save the design to keep it.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not upload image.')
    }
  }

  const updateContentStyle = (target: ContentSelection, style: NativeBlockStyle | undefined, update: Partial<NativeBlockStyle>) => {
    const next = { ...(style ?? defaultNativeBlockStyle), ...update }
    if (target.kind === 'section') updateSection(target.sectionId, { designStyle: next })
    else updateBlock(target.sectionId, target.blockId, { designStyle: next })
  }

  const applyStyleToSectionRows = (sectionId: string, style: NativeBlockStyle | undefined) => {
    const nextStyle = { ...(style ?? defaultNativeBlockStyle) }
    setDocument((current) => current ? {
      ...current,
      sections: current.sections.map((section) => section.id === sectionId ? {
        ...section,
        rows: section.rows.map((block) => block.blockType === 'row' ? { ...block, designStyle: { ...nextStyle } } : block),
      } : section),
    } : current)
  }

  if (!document) return <p>{status || 'Loading design workspace...'}</p>
  const pageBlockStyle: NativeBlockStyle = { ...defaultNativeBlockStyle, backgroundColor: document.pattern.style.backgroundColor, textColor: document.pattern.style.textColor }
  const baseGridLayout = reconcileNativeGridLayout(document.pattern.style.gridLayout, document.sections, document.colors.length > 0)
  const gridLayout = drawerPreview
    ? gridCompactorRef.current.compact([...baseGridLayout, drawerPreview], 12) as NativeGridItem[]
    : baseGridLayout

  return <section className="native-design-page">
    <header className="native-design-toolbar">
      <a className="button" href={`/pattern/${patternId}/edit`}><ArrowLeft size={15} /> Write</a>
      <div><span className="kicker">Design</span><strong>{document.pattern.title}</strong></div>
      <span aria-live="polite">{status}</span>
      <button className="button" disabled={saving} onClick={() => void save()} type="button"><Save size={15} /> Save</button>
      <button className="button button-primary" disabled={saving} onClick={async () => { if (await save()) window.location.href = `/pattern/${patternId}/preview` }} type="button"><Eye size={15} /> Preview & finalize</button>
    </header>

    <div className="native-design-workspace">
      <aside className="native-design-controls">
        <section className="native-widget-drawer">
          <div><span className="kicker">Components</span><h2>Drag onto the grid</h2></div>
          <div className="native-widget-drawer-grid">{drawerWidgets.map(({ icon: Icon, kind, label }) => <button draggable key={kind} onClick={() => addWidget(kind)} onDragEnd={() => { draggedWidgetKindRef.current = null; gridInteractionRef.current = null; setDrawerPreview(null); setDraggingOverGrid(false) }} onDragStart={(event) => { draggedWidgetKindRef.current = kind; event.dataTransfer.setData('application/x-gityarn-widget', kind); event.dataTransfer.setData('text/plain', kind); event.dataTransfer.effectAllowed = 'copy' }} type="button"><Icon size={17} /><span>{label}</span></button>)}</div>
        </section>
        <h2>Design settings</h2>
        <SettingsPanel id={settingsPanelId({ kind: 'page' })} label="Page" onOpen={() => setSelection({ kind: 'page' })} open={selection.kind === 'page'}>
          <label>Cover layout<select onChange={(event) => updatePatternStyle({ coverLayout: event.target.value as NativePatternStyle['coverLayout'] })} value={document.pattern.style.coverLayout}><option value="hero">Hero</option><option value="split">Split</option><option value="minimal">Minimal</option></select></label>
          <BackgroundPatternPicker onChange={(backgroundPattern) => updatePatternStyle({ backgroundPattern })} style={document.pattern.style} />
          <div className="native-design-color-grid"><label>Pattern background<input disabled={document.pattern.style.backgroundPattern === 'none'} onChange={(event) => updatePatternStyle({ patternBackgroundColor: event.target.value })} type="color" value={document.pattern.style.patternBackgroundColor} /></label><label>Pattern foreground<input disabled={document.pattern.style.backgroundPattern === 'none'} onChange={(event) => updatePatternStyle({ patternColor: event.target.value })} type="color" value={document.pattern.style.patternColor} /></label></div>
          <label>Pattern opacity <span>{document.pattern.style.patternOpacity}%</span><input disabled={document.pattern.style.backgroundPattern === 'none'} max="100" min="0" onChange={(event) => updatePatternStyle({ patternOpacity: Number(event.target.value) })} type="range" value={document.pattern.style.patternOpacity} /></label>
          <FontPicker label="Heading font" onChange={(headingFont) => updatePatternStyle({ headingFont: headingFont as NativePatternStyle['headingFont'] })} options={headingFontOptions} value={document.pattern.style.headingFont} />
          <FontPicker label="Body font" onChange={(bodyFont) => updatePatternStyle({ bodyFont: bodyFont as NativePatternStyle['bodyFont'] })} options={bodyFontOptions} value={document.pattern.style.bodyFont} />
          <label>Row spacing<select onChange={(event) => updatePatternStyle({ rowDensity: event.target.value as NativePatternStyle['rowDensity'] })} value={document.pattern.style.rowDensity}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
          <label>Image style<select onChange={(event) => updatePatternStyle({ imageTreatment: event.target.value as NativePatternStyle['imageTreatment'] })} value={document.pattern.style.imageTreatment}><option value="edge">Edge to edge</option><option value="rounded">Rounded</option><option value="framed">Framed</option></select></label>
          <div className="native-design-color-grid"><label>Page<input onChange={(event) => updatePatternStyle({ backgroundColor: replaceColor(document.pattern.style.backgroundColor, event.target.value) })} type="color" value={opaqueColor(document.pattern.style.backgroundColor)} /></label><label>Text<input onChange={(event) => updatePatternStyle({ textColor: event.target.value })} type="color" value={document.pattern.style.textColor} /></label><label>Accent<input onChange={(event) => updatePatternStyle({ accentColor: event.target.value })} type="color" value={document.pattern.style.accentColor} /></label><label>Notes<input onChange={(event) => updatePatternStyle({ noteColor: event.target.value })} type="color" value={document.pattern.style.noteColor} /></label></div>
          <label>Page background opacity <span>{colorOpacity(document.pattern.style.backgroundColor)}%</span><input max="100" min="0" onChange={(event) => updatePatternStyle({ backgroundColor: withColorOpacity(document.pattern.style.backgroundColor, Number(event.target.value)) })} type="range" value={colorOpacity(document.pattern.style.backgroundColor)} /></label>
          <label>Title background<input onChange={(event) => updatePatternStyle({ coverBackgroundColor: replaceColor(document.pattern.style.coverBackgroundColor, event.target.value) })} type="color" value={opaqueColor(document.pattern.style.coverBackgroundColor)} /></label>
          <label>Title background opacity <span>{colorOpacity(document.pattern.style.coverBackgroundColor)}%</span><input max="100" min="0" onChange={(event) => updatePatternStyle({ coverBackgroundColor: withColorOpacity(document.pattern.style.coverBackgroundColor, Number(event.target.value)) })} type="range" value={colorOpacity(document.pattern.style.coverBackgroundColor)} /></label>
          <label className="native-style-toggle"><input checked={document.pattern.style.showStitchCounts} onChange={(event) => updatePatternStyle({ showStitchCounts: event.target.checked })} type="checkbox" /> Show stitch counts</label>
        </SettingsPanel>
        <SettingsPanel id={settingsPanelId({ kind: 'builtin', widgetId: 'cover' })} label="Cover item" onOpen={() => setSelection({ kind: 'builtin', widgetId: 'cover' })} open={selection.kind === 'builtin' && selection.widgetId === 'cover'}>
          <StyleSettings onChange={(update) => updateBuiltinWidgetStyle('cover', update)} showTextAlignment style={document.pattern.style.widgetStyles.cover ?? pageBlockStyle} />
        </SettingsPanel>
        {document.colors.length ? <SettingsPanel id={settingsPanelId({ kind: 'builtin', widgetId: 'palette' })} label="Color legend item" onOpen={() => setSelection({ kind: 'builtin', widgetId: 'palette' })} open={selection.kind === 'builtin' && selection.widgetId === 'palette'}>
          <StyleSettings onChange={(update) => updateBuiltinWidgetStyle('palette', update)} showTextAlignment style={document.pattern.style.widgetStyles.palette ?? pageBlockStyle} />
        </SettingsPanel> : null}
        {document.sections.map((section, sectionIndex) => <div className="native-settings-section" key={section.id}>
          <SettingsPanel id={settingsPanelId({ kind: 'section', sectionId: section.id })} label={section.sectionType === 'text' ? `Text section ${sectionIndex + 1}` : `${sectionIndex + 1}. ${section.title || 'Untitled section'}`} onOpen={() => setSelection({ kind: 'section', sectionId: section.id })} open={selection.kind === 'section' && selection.sectionId === section.id}>
            <SectionContentSettings onUpload={(blockId, file) => uploadBlockImage(section.id, blockId, file)} section={section} updateBlock={(blockId, update) => updateBlock(section.id, blockId, update)} updateSection={(update) => updateSection(section.id, update)} />
            <StyleSettings onChange={(update) => updateContentStyle(sectionStyleTarget(section), sectionItemStyle(section), update)} showTextAlignment={sectionHasTextAlignment(section)} style={sectionItemStyle(section)} />
          </SettingsPanel>
          {section.sectionType === 'pattern' ? <div className="native-settings-blocks">{section.rows.map((block, blockIndex) => <SettingsPanel id={settingsPanelId({ kind: 'block', sectionId: section.id, blockId: block.id })} key={block.id} label={blockSettingsLabel(block, blockIndex)} onOpen={() => setSelection({ kind: 'block', sectionId: section.id, blockId: block.id })} open={selection.kind === 'block' && selection.sectionId === section.id && selection.blockId === block.id}>
            <StyleSettings block={block} inheritControls onApplyToRows={() => applyStyleToSectionRows(section.id, block.designStyle)} onChange={(update) => updateContentStyle({ kind: 'block', sectionId: section.id, blockId: block.id }, block.designStyle, update)} showTextAlignment={block.blockType !== 'image'} style={block.designStyle} />
          </SettingsPanel>)}</div> : null}
        </div>)}
      </aside>

      <main className={`native-design-canvas native-grid-designer ${draggingOverGrid ? 'accepting-widget' : ''} pattern-${document.pattern.style.backgroundPattern} heading-${document.pattern.style.headingFont} body-${document.pattern.style.bodyFont} density-${document.pattern.style.rowDensity} images-${document.pattern.style.imageTreatment}`} onDragOverCapture={previewDrawerWidget} onDropCapture={dropWidgetOnGrid} ref={containerRef} style={{ '--native-bg': document.pattern.style.backgroundColor, '--native-cover-bg': document.pattern.style.coverBackgroundColor, '--native-text': document.pattern.style.textColor, '--native-accent': document.pattern.style.accentColor, '--native-note': document.pattern.style.noteColor } as CSSProperties}>
        <NativePatternBackground backgroundColor={document.pattern.style.patternBackgroundColor} color={document.pattern.style.patternColor} opacity={document.pattern.style.patternOpacity} pattern={document.pattern.style.backgroundPattern} />
        <GridLayout autoSize className="native-widget-grid-editor" compactor={gridCompactorRef.current} dragConfig={{ enabled: true, bounded: false, handle: '.native-widget-drag-handle', cancel: 'input, textarea, select, button:not(.native-widget-drag-handle), label', threshold: 3 }} gridConfig={{ cols: 12, rowHeight: 32, margin: [10, 10], containerPadding: [24, 24], maxRows: Infinity }} key={gridLayout.map((item) => item.i).join('|')} layout={gridLayout} onDragStart={(layout, oldItem) => { gridInteractionRef.current = oldItem ? { activeId: oldItem.i, baseline: layout.map((item) => ({ ...item })), original: { i: oldItem.i, x: oldItem.x, y: oldItem.y, w: oldItem.w, h: oldItem.h } } : null }} onDragStop={() => { gridInteractionRef.current = null }} onLayoutChange={updateGridLayout} onResizeStart={(layout, oldItem) => { gridInteractionRef.current = oldItem ? { activeId: oldItem.i, baseline: layout.map((item) => ({ ...item })), original: { i: oldItem.i, x: oldItem.x, y: oldItem.y, w: oldItem.w, h: oldItem.h } } : null }} onResizeStop={() => { gridInteractionRef.current = null }} resizeConfig={{ enabled: true, handles: ['se'] }} width={gridWidth}>
          {gridLayout.map((item) => {
            const section = item.sectionId ? document.sections.find((candidate) => candidate.id === item.sectionId) ?? null : null
            const selected = item.kind === 'cover' || item.kind === 'palette' ? selection.kind === 'builtin' && selection.widgetId === item.kind : selection.kind !== 'page' && selection.kind !== 'builtin' && selection.sectionId === item.sectionId
            return <div {...{ 'data-grid': item }} className={`native-grid-widget widget-${item.kind} ${selected ? 'selected' : ''}`} data-widget-id={item.i} key={item.i} onClick={() => item.kind === 'cover' || item.kind === 'palette' ? setSelection({ kind: 'builtin', widgetId: item.kind }) : section && setSelection({ kind: 'section', sectionId: section.id })}>
              <div className="native-grid-widget-bar"><button aria-label="Move widget" className="native-widget-drag-handle" type="button"><Move size={14} /></button><span>{widgetLabel(item.kind, section)}</span>{section && section.sectionType !== 'pattern' ? <button aria-label="Delete widget" onClick={(event) => { event.stopPropagation(); setDocument((current) => current ? { ...current, sections: current.sections.filter((candidate) => candidate.id !== section.id), pattern: { ...current.pattern, style: { ...current.pattern.style, gridLayout: current.pattern.style.gridLayout.filter((candidate) => candidate.sectionId !== section.id) } } } : current); setSelection({ kind: 'page' }) }} type="button"><Trash2 size={13} /></button> : null}</div>
              <div className="native-grid-widget-content">
                {item.i === drawerPreviewId ? <div className="native-grid-drawer-preview">Drop {widgetLabel(item.kind, null)} here</div> : <NativePatternWidgetContent colors={document.colors} onColorChange={(colorId, color) => setDocument((current) => current ? { ...current, colors: current.colors.map((item) => item.id === colorId ? { ...item, hexColor: color } : item) } : current)} onToggleRow={() => undefined} pageStyle={pageBlockStyle} pattern={document.pattern} rowNumberStart={rowNumberBeforeWidget(item, gridLayout, document.sections)} section={section} widget={item} />}
              </div>
            </div>
          })}
        </GridLayout>
      </main>
    </div>
  </section>
}

function SettingsPanel({ children, id, label, onOpen, open }: { children: ReactNode; id: string; label: string; onOpen: () => void; open: boolean }) {
  return <section className={`native-settings-panel ${open ? 'open' : ''}`} id={id}>
    <button aria-expanded={open} className="native-settings-panel-trigger" onClick={onOpen} type="button"><span>{label}</span><ChevronDown size={15} /></button>
    {open ? <div className="native-settings-panel-body">{children}</div> : null}
  </section>
}

function SectionContentSettings({ onUpload, section, updateBlock, updateSection }: { onUpload: (blockId: string, file: File) => void; section: DesignSection; updateBlock: (blockId: string, update: Partial<DesignBlock>) => void; updateSection: (update: Partial<DesignSection>) => void }) {
  const block = section.rows[0]
  if (section.sectionType === 'heading') return <label>Heading text<input onChange={(event) => updateSection({ title: event.target.value })} value={section.title} /></label>
  if (section.sectionType === 'text' && block) return <fieldset className="native-widget-content-settings"><legend>Content</legend>
    <label>Heading<input onChange={(event) => updateBlock(block.id, { blockHeading: event.target.value })} value={block.blockHeading ?? ''} /></label>
    <label>Text<textarea onChange={(event) => updateBlock(block.id, { instruction: event.target.value })} rows={5} value={block.instruction} /></label>
  </fieldset>
  if (section.sectionType === 'note' && block) return <label>Callout text<textarea onChange={(event) => updateBlock(block.id, { instruction: event.target.value })} rows={5} value={block.instruction} /></label>
  if (section.sectionType === 'image' && block) return <fieldset className="native-widget-content-settings"><legend>Image</legend>
    <FileDropInput accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" hint={block.imageSrc ? 'Replace image' : 'Upload image'} onSelect={(files) => { if (files[0]) onUpload(block.id, files[0]) }} />
    <label>Caption<input onChange={(event) => updateBlock(block.id, { imageCaption: event.target.value })} value={block.imageCaption ?? ''} /></label>
    <label>Alternative text<input onChange={(event) => updateBlock(block.id, { imageAltText: event.target.value })} value={block.imageAltText ?? ''} /></label>
  </fieldset>
  return null
}

function StyleSettings({ block, inheritControls = false, onApplyToRows, onChange, showTextAlignment = false, style }: { block?: DesignBlock; inheritControls?: boolean; onApplyToRows?: () => void; onChange: (update: Partial<NativeBlockStyle>) => void; showTextAlignment?: boolean; style?: NativeBlockStyle }) {
  const value = style ?? defaultNativeBlockStyle
  return <>
    <div className="native-design-color-grid"><label>Background<input disabled={inheritControls && value.inheritBackground} onChange={(event) => onChange({ backgroundColor: replaceColor(value.backgroundColor, event.target.value), ...(!inheritControls ? { inheritBackground: false } : {}) })} type="color" value={opaqueColor(value.backgroundColor)} /></label><label>Text<input disabled={inheritControls && value.inheritText} onChange={(event) => onChange({ textColor: event.target.value, ...(!inheritControls ? { inheritText: false } : {}) })} type="color" value={value.textColor} /></label><label>Border<input disabled={inheritControls && value.inheritBorder} onChange={(event) => onChange({ borderColor: event.target.value, ...(!inheritControls ? { inheritBorder: false } : {}) })} type="color" value={value.borderColor} /></label></div>
    <label>Background opacity <span>{colorOpacity(value.backgroundColor)}%</span><input disabled={inheritControls && value.inheritBackground} max="100" min="0" onChange={(event) => onChange({ backgroundColor: withColorOpacity(value.backgroundColor, Number(event.target.value)), ...(!inheritControls ? { inheritBackground: false } : {}) })} type="range" value={colorOpacity(value.backgroundColor)} /></label>
    <label>Border width<select disabled={inheritControls && value.inheritBorder} onChange={(event) => onChange({ borderWidth: Number(event.target.value) as NativeBlockStyle['borderWidth'], ...(!inheritControls ? { inheritBorder: false } : {}) })} value={value.borderWidth}><option value="0">None</option><option value="1">Thin</option><option value="2">Medium</option><option value="4">Heavy</option></select></label>
    <label>Padding<input disabled={inheritControls && value.inheritPadding} max="64" min="0" onChange={(event) => onChange({ padding: Number(event.target.value), ...(!inheritControls ? { inheritPadding: false } : {}) })} type="range" value={value.padding} /></label>
    <label>Corner radius<input disabled={inheritControls && value.inheritRadius} max="40" min="0" onChange={(event) => onChange({ borderRadius: Number(event.target.value), ...(!inheritControls ? { inheritRadius: false } : {}) })} type="range" value={value.borderRadius} /></label>
    {showTextAlignment ? <label>Text alignment<select disabled={inheritControls && value.inheritAlignment} onChange={(event) => onChange({ textAlign: event.target.value as NativeBlockStyle['textAlign'], ...(!inheritControls ? { inheritAlignment: false } : {}) })} value={value.textAlign}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label> : null}
    {block && (block.blockType === 'image' || block.blockType === 'note') ? <label>Float<select onChange={(event) => { const float = event.target.value as NativeBlockStyle['float']; onChange({ float, width: float !== 'none' && value.width === 100 ? 45 : value.width }) }} value={value.float}><option value="none">No float</option><option value="left">Float left</option><option value="right">Float right</option></select></label> : null}
    {inheritControls ? <fieldset className="native-inherit-controls"><legend>Inherit from section</legend>
      <label><input checked={value.inheritBackground} onChange={(event) => onChange({ inheritBackground: event.target.checked })} type="checkbox" /> Background</label>
      <label><input checked={value.inheritText} onChange={(event) => onChange({ inheritText: event.target.checked })} type="checkbox" /> Text color</label>
      <label><input checked={value.inheritBorder} onChange={(event) => onChange({ inheritBorder: event.target.checked })} type="checkbox" /> Border</label>
      <label><input checked={value.inheritPadding} onChange={(event) => onChange({ inheritPadding: event.target.checked })} type="checkbox" /> Padding</label>
      <label><input checked={value.inheritRadius} onChange={(event) => onChange({ inheritRadius: event.target.checked })} type="checkbox" /> Radius</label>
      {showTextAlignment ? <label><input checked={value.inheritAlignment} onChange={(event) => onChange({ inheritAlignment: event.target.checked })} type="checkbox" /> Text alignment</label> : null}
    </fieldset> : null}
    {block?.blockType === 'row' ? <button className="button" onClick={onApplyToRows} type="button">Apply style to all rows in this section</button> : null}
  </>
}

function settingsPanelId(selection: Selection) {
  if (selection.kind === 'page') return 'settings-page'
  if (selection.kind === 'builtin') return `settings-${selection.widgetId}`
  if (selection.kind === 'section') return `settings-section-${selection.sectionId}`
  return `settings-block-${selection.sectionId}-${selection.blockId}`
}

function sectionStyleTarget(section: DesignSection): ContentSelection {
  const block = section.rows[0]
  return (section.sectionType === 'text' || section.sectionType === 'note' || section.sectionType === 'image') && block
    ? { kind: 'block', sectionId: section.id, blockId: block.id }
    : { kind: 'section', sectionId: section.id }
}

function sectionItemStyle(section: DesignSection) {
  const target = sectionStyleTarget(section)
  return target.kind === 'block' ? section.rows.find((block) => block.id === target.blockId)?.designStyle : section.designStyle
}

function sectionHasTextAlignment(section: DesignSection) {
  return section.sectionType === 'pattern' || section.sectionType === 'text' || section.sectionType === 'note' || section.sectionType === 'heading'
}

function blockSettingsLabel(block: DesignBlock, index: number) {
  if (block.blockType === 'text') return block.blockHeading || 'Text block'
  if (block.blockType === 'note') return `Note ${index + 1}`
  if (block.blockType === 'image') return block.imageCaption || `Image ${index + 1}`
  if (block.rowType === 'magic-ring') return 'Magic ring'
  if (block.rowType === 'chain') return 'Starting chain'
  return `${block.rowType === 'round' ? 'Round' : 'Row'} ${index + 1}`
}

function opaqueColor(color: string) {
  return color.slice(0, 7)
}

function colorOpacity(color: string) {
  return color.length === 9 ? Math.round((Number.parseInt(color.slice(7), 16) / 255) * 100) : 100
}

function withColorOpacity(color: string, opacity: number) {
  const alpha = Math.round(Math.max(0, Math.min(100, opacity)) * 2.55)
  return `${opaqueColor(color)}${alpha === 255 ? '' : alpha.toString(16).padStart(2, '0').toUpperCase()}`
}

function replaceColor(current: string, next: string) {
  return withColorOpacity(next, colorOpacity(current))
}

function promoteTextBlocks(document: DesignDocument): DesignDocument {
  const sections = document.sections.flatMap((section) => {
    if (section.sectionType === 'text') return [section]
    const textBlocks = section.rows.filter((block) => block.blockType === 'text')
    if (!textBlocks.length) return [section]
    return [
      { ...section, rows: section.rows.filter((block) => block.blockType !== 'text') },
      ...textBlocks.map((block): DesignSection => ({
        id: crypto.randomUUID(),
        sectionType: 'text',
        title: block.blockHeading || 'Text section',
        notes: null,
        designStyle: block.designStyle ?? { ...defaultNativeBlockStyle, padding: 24 },
        rows: [block],
      })),
    ]
  })
  return { ...document, sections }
}

function withGridLayout(document: DesignDocument): DesignDocument {
  return {
    ...document,
    pattern: {
      ...document.pattern,
      style: {
        ...document.pattern.style,
        gridLayout: reconcileNativeGridLayout(document.pattern.style.gridLayout, document.sections, document.colors.length > 0),
      },
    },
  }
}

function sameGridLayout(left: NativeGridItem[], right: NativeGridItem[]) {
  if (left.length !== right.length) return false
  const rightById = new Map(right.map((item) => [item.i, item]))
  return left.every((item) => {
    const candidate = rightById.get(item.i)
    return candidate && item.x === candidate.x && item.y === candidate.y && item.w === candidate.w && item.h === candidate.h
  })
}

function rowNumberBeforeWidget(widget: NativeGridItem, layout: NativeGridItem[], sections: DesignSection[]) {
  let rowNumber = 0
  for (const item of [...layout].sort((left, right) => left.y - right.y || left.x - right.x)) {
    if (item.i === widget.i) break
    const section = item.sectionId ? sections.find((candidate) => candidate.id === item.sectionId) : null
    if (section?.sectionType === 'pattern') rowNumber += section.rows.filter((block) => block.blockType === 'row' && block.rowType !== 'chain' && block.rowType !== 'magic-ring').length
  }
  return rowNumber
}

function gridDropPosition(event: ReactDragEvent<HTMLElement>, kind: NativeWidgetKind) {
  const rect = event.currentTarget.getBoundingClientRect()
  const width = kind === 'heading' || kind === 'divider' || kind === 'spacer' ? 12 : 6
  const height = defaultWidgetHeight(kind)
  const padding = 24
  const margin = 10
  const columnWidth = (rect.width - padding * 2 - margin * 11) / 12
  const stride = columnWidth + margin
  const itemWidth = columnWidth * width + margin * (width - 1)
  const itemHeight = 32 * height + margin * (height - 1)
  const rawX = Math.round((event.clientX - rect.left - padding - itemWidth / 2) / stride)
  const rawY = Math.round((event.clientY - rect.top - padding - itemHeight / 2) / 42)
  return { x: Math.max(0, Math.min(12 - width, rawX)), y: Math.max(0, rawY) }
}

function findAvailableGridPosition(layout: NativeGridItem[], desired: { x: number; y: number; w: number; h: number }) {
  const bottom = layout.reduce((value, item) => Math.max(value, item.y + item.h), desired.y)
  for (let y = desired.y; y <= bottom + desired.h; y += 1) {
    const columns = [desired.x, ...Array.from({ length: 13 - desired.w }, (_, x) => x).filter((x) => x !== desired.x)]
    for (const x of columns) {
      const collides = layout.some((item) => x < item.x + item.w && x + desired.w > item.x && y < item.y + item.h && y + desired.h > item.y)
      if (!collides) return { x, y }
    }
  }
  return { x: 0, y: bottom }
}

const drawerPreviewId = '__drawer-preview__'

const drawerWidgets = [
  { kind: 'section', label: 'Pattern section', icon: GripVertical },
  { kind: 'text', label: 'Text', icon: Type },
  { kind: 'image', label: 'Image', icon: ImageIcon },
  { kind: 'note', label: 'Callout', icon: MessageSquareText },
  { kind: 'heading', label: 'Heading', icon: Heading2 },
  { kind: 'divider', label: 'Divider', icon: Minus },
  { kind: 'spacer', label: 'Spacer', icon: Space },
] as const

function widgetLabel(kind: NativeWidgetKind, section: DesignSection | null) {
  if (kind === 'cover') return 'Cover'
  if (kind === 'palette') return 'Color legend'
  if (kind === 'section') return section?.title || 'Pattern section'
  return section?.title || kind[0]?.toUpperCase() + kind.slice(1)
}

const headingFontOptions: Array<{ value: NativePatternStyle['headingFont']; label: string }> = [
  { value: 'serif', label: 'System serif' }, { value: 'sans', label: 'System sans' }, { value: 'rounded', label: 'System rounded' },
  { value: 'fraunces', label: 'Fraunces' }, { value: 'playfair', label: 'Playfair Display' }, { value: 'lora', label: 'Lora' },
  { value: 'quicksand', label: 'Quicksand' }, { value: 'raleway', label: 'Raleway' }, { value: 'fredoka', label: 'Fredoka' },
  { value: 'pacifico', label: 'Pacifico' }, { value: 'caveat', label: 'Caveat' }, { value: 'comfortaa', label: 'Comfortaa' },
  { value: 'balsamiq', label: 'Balsamiq Sans' },
]

const bodyFontOptions: Array<{ value: NativePatternStyle['bodyFont']; label: string }> = [
  { value: 'sans', label: 'System sans' }, { value: 'serif', label: 'System serif' }, { value: 'mono', label: 'System mono' },
  { value: 'dm-sans', label: 'DM Sans' }, { value: 'atkinson', label: 'Atkinson Hyperlegible' }, { value: 'lora', label: 'Lora' },
  { value: 'nunito', label: 'Nunito' }, { value: 'raleway', label: 'Raleway' }, { value: 'source-serif', label: 'Source Serif 4' },
  { value: 'space-mono', label: 'Space Mono' }, { value: 'fredoka', label: 'Fredoka' }, { value: 'comfortaa', label: 'Comfortaa' },
  { value: 'balsamiq', label: 'Balsamiq Sans' }, { value: 'patrick-hand', label: 'Patrick Hand' },
]

function fontStack(font: NativePatternStyle['headingFont'] | NativePatternStyle['bodyFont']) {
  const stacks: Record<string, string> = {
    serif: "Georgia, 'Times New Roman', serif", sans: 'Inter, system-ui, sans-serif', rounded: "'Trebuchet MS', sans-serif", mono: 'ui-monospace, monospace',
    fraunces: "'Fraunces', Georgia, serif", playfair: "'Playfair Display', Georgia, serif", lora: "'Lora', Georgia, serif", quicksand: "'Quicksand', sans-serif",
    raleway: "'Raleway', sans-serif", fredoka: "'Fredoka', sans-serif", pacifico: "'Pacifico', cursive", caveat: "'Caveat', cursive",
    comfortaa: "'Comfortaa', sans-serif", balsamiq: "'Balsamiq Sans', sans-serif", 'dm-sans': "'DM Sans', sans-serif", atkinson: "'Atkinson Hyperlegible', sans-serif",
    nunito: "'Nunito', sans-serif", 'source-serif': "'Source Serif 4', Georgia, serif", 'space-mono': "'Space Mono', monospace", 'patrick-hand': "'Patrick Hand', cursive",
  }
  return stacks[font] ?? stacks.sans
}

function FontPicker({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; value: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const selected = options.find((font) => font.value === value)
  return <label>{label}<details className="native-font-picker" ref={detailsRef}>
    <summary style={{ fontFamily: fontStack(value as NativePatternStyle['headingFont']) }}>{selected?.label ?? value}</summary>
    <div>{options.map((font) => <button aria-pressed={font.value === value} key={font.value} onClick={() => { onChange(font.value); if (detailsRef.current) detailsRef.current.open = false }} style={{ fontFamily: fontStack(font.value as NativePatternStyle['headingFont']) }} type="button">{font.label}</button>)}</div>
  </details></label>
}

function BackgroundPatternPicker({ onChange, style }: { onChange: (value: NativePatternStyle['backgroundPattern']) => void; style: NativePatternStyle }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const selected = nativeBackgroundPatternOptions.find((option) => option.value === style.backgroundPattern) ?? nativeBackgroundPatternOptions[0]
  const swatchStyle = (pattern: NativePatternStyle['backgroundPattern']) => heroBackgroundStyle(pattern, style.patternColor, style.patternBackgroundColor, style.patternOpacity)

  return <details className="native-background-pattern-picker" ref={detailsRef}>
    <summary>
      <span className="native-background-pattern-summary-swatch" style={swatchStyle(selected.value)} />
      <span><small>Background pattern</small><strong>{selected.label}</strong></span>
    </summary>
    <div className="native-background-pattern-options">{nativeBackgroundPatternOptions.map((option) => <button aria-pressed={style.backgroundPattern === option.value} key={option.value} onClick={() => { onChange(option.value); if (detailsRef.current) detailsRef.current.open = false }} type="button"><span className="native-background-pattern-swatch" style={swatchStyle(option.value)} /><strong>{option.label}</strong></button>)}</div>
    <a href="https://heropatterns.com/" rel="noreferrer" target="_blank">Artwork by Hero Patterns · CC BY 4.0</a>
  </details>
}
