import type { CSSProperties } from 'react'

import { defaultNativeBlockStyle, resolveNativeBlockStyle } from '#/lib/patterns/native-document'
import type { NativeBlockStyle, NativePatternStyle } from '#/lib/patterns/native-document'
import { heroBackgroundStyle } from '#/lib/patterns/hero-backgrounds'
import { reconcileNativeGridLayout } from '#/lib/patterns/native-layout'
import type { NativeGridItem, NativeSectionType } from '#/lib/patterns/native-layout'

export type RenderedNativeBlock = {
  id: string
  blockType: 'row' | 'note' | 'image' | 'text'
  rowType: 'chain' | 'magic-ring' | 'row' | 'round'
  instruction: string
  computedStitchCount: number | null
  colorKey: string | null
  imageSrc?: string | null
  imageAltText?: string | null
  imageCaption?: string | null
  blockHeading?: string | null
  designStyle?: NativeBlockStyle
}

export type RenderedNativePattern = {
  pattern: {
    title: string
    description: string | null
    difficulty: string | null
    coverSrc: string | null
    style: NativePatternStyle
  }
  colors: Array<{ id: string; key: string; label: string; hexColor: string | null }>
  sections: RenderedNativeSection[]
}

export type RenderedNativeSection = { id: string; sectionType: NativeSectionType; title: string; notes: string | null; designStyle?: NativeBlockStyle; rows: RenderedNativeBlock[] }

export function NativePatternRenderer({ colorOverrides = {}, completedRowIds = new Set(), document, onColorChange, onResetColors, onToggleRow }: { document: RenderedNativePattern; colorOverrides?: Record<string, string>; completedRowIds?: Set<string>; onColorChange?: (colorId: string, color: string) => void; onResetColors?: () => void; onToggleRow?: (rowId: string, completed: boolean) => void }) {
  const { pattern, colors, sections } = document
  const style = {
    '--native-bg': pattern.style.backgroundColor,
    '--native-cover-bg': pattern.style.coverBackgroundColor,
    '--native-text': pattern.style.textColor,
    '--native-accent': pattern.style.accentColor,
    '--native-note': pattern.style.noteColor,
  } as CSSProperties
  const pageStyle: NativeBlockStyle = { ...defaultNativeBlockStyle, backgroundColor: pattern.style.backgroundColor, textColor: pattern.style.textColor }
  const gridLayout = reconcileNativeGridLayout(pattern.style.gridLayout, sections, colors.length > 0).sort((a, b) => a.y - b.y || a.x - b.x)
  let rowNumber = 0

  return (
    <article className={`native-pattern-view pattern-${pattern.style.backgroundPattern} heading-${pattern.style.headingFont} body-${pattern.style.bodyFont} density-${pattern.style.rowDensity} images-${pattern.style.imageTreatment}`} style={style}>
      <NativePatternBackground backgroundColor={pattern.style.patternBackgroundColor} color={pattern.style.patternColor} opacity={pattern.style.patternOpacity} pattern={pattern.style.backgroundPattern} />
      <div className="native-published-widget-grid">
        {gridLayout.map((widget) => {
          const section = widget.sectionId ? sections.find((candidate) => candidate.id === widget.sectionId) : null
          if (widget.kind === 'palette' && !colors.length) return null
          if (widget.sectionId && !section) return null
          const className = `native-published-widget${widget.kind === 'cover' ? ' widget-cover' : widget.kind === 'palette' ? ' widget-palette' : widget.kind === 'heading' ? ' widget-heading' : widget.kind === 'divider' ? ' widget-divider' : widget.kind === 'spacer' ? ' widget-spacer' : ''}`
          const content = <NativePatternWidgetContent colorOverrides={colorOverrides} colors={colors} completedRowIds={completedRowIds} onColorChange={onColorChange} onResetColors={onResetColors} onToggleRow={onToggleRow} pageStyle={pageStyle} pattern={pattern} rowNumberStart={rowNumber} section={section} widget={widget} />
          if (section?.sectionType === 'pattern') rowNumber += countNumberedRows(section)
          return <div aria-hidden={widget.kind === 'spacer' ? true : undefined} className={className} key={widget.i} style={widgetGridStyle(widget)}>{content}</div>
        })}
      </div>
    </article>
  )
}

export function NativePatternWidgetContent({ colorOverrides = {}, colors, completedRowIds = new Set(), onColorChange, onResetColors, onToggleRow, pageStyle, pattern, rowNumberStart = 0, section, widget }: { colorOverrides?: Record<string, string>; colors: RenderedNativePattern['colors']; completedRowIds?: Set<string>; onColorChange?: (colorId: string, color: string) => void; onResetColors?: () => void; onToggleRow?: (rowId: string, completed: boolean) => void; pageStyle: NativeBlockStyle; pattern: RenderedNativePattern['pattern']; rowNumberStart?: number; section?: RenderedNativeSection | null; widget: NativeGridItem }) {
  const savedWidgetStyle = pattern.style.widgetStyles[widget.i]
  const widgetStyle = savedWidgetStyle ? resolveNativeBlockStyle(savedWidgetStyle, pageStyle) : pageStyle
  if (widget.kind === 'cover') return <header className={`native-pattern-cover layout-${pattern.style.coverLayout}`} style={blockStyle(widgetStyle)}>
    {pattern.coverSrc ? <img alt="" src={pattern.coverSrc} /> : null}
    <div className="native-pattern-cover-copy">{pattern.difficulty ? <span>{pattern.difficulty}</span> : null}<h1>{pattern.title}</h1>{pattern.description ? <p>{pattern.description}</p> : null}</div>
  </header>
  if (widget.kind === 'palette') return <section className={`native-pattern-palette ${onColorChange ? 'editable' : ''}`} aria-label="Yarn colors" style={blockStyle(widgetStyle)}>
    {onColorChange ? <header className="native-pattern-palette-header"><div><strong>Your yarn colors</strong><span>Change a swatch to update every row using that color.</span></div>{Object.keys(colorOverrides).length ? <button className="button" onClick={onResetColors} type="button">Reset colors</button> : null}</header> : null}
    {colors.map((color) => { const resolvedColor = colorOverrides[color.id] ?? color.hexColor ?? '#C78AA8'; return onColorChange ? <label className="native-pattern-color-variable" key={color.id}><input aria-label={`Change ${color.key} color`} onChange={(event) => onColorChange(color.id, event.target.value)} onClick={(event) => event.stopPropagation()} type="color" value={resolvedColor} /><strong>{color.key}</strong><span>{color.label}</span></label> : <div className="native-pattern-color-variable" key={color.id}><i style={{ backgroundColor: resolvedColor }} /><strong>{color.key}</strong><span>{color.label}</span></div> })}
  </section>
  if (!section) return null
  const sectionStyle = savedWidgetStyle ? widgetStyle : resolveNativeBlockStyle(section.designStyle, pageStyle)
  if (section.sectionType === 'text') {
    const text = section.rows.find((block) => block.blockType === 'text')
    return <section className="native-pattern-standalone-text" style={blockStyle(resolveNativeBlockStyle(text?.designStyle, sectionStyle))}>{text?.blockHeading || section.title ? <h2>{text?.blockHeading || section.title}</h2> : null}{text?.instruction ? <p>{text.instruction}</p> : null}</section>
  }
  if (section.sectionType === 'heading') return <h2 style={blockStyle(sectionStyle)}>{section.title}</h2>
  if (section.sectionType === 'divider') return <hr style={{ borderColor: sectionStyle.textColor }} />
  if (section.sectionType === 'spacer') return null
  if (section.sectionType === 'image') { const image = section.rows.find((block) => block.blockType === 'image'); return <figure className="native-pattern-view-image" style={blockStyle(resolveNativeBlockStyle(image?.designStyle, sectionStyle))}>{image?.imageSrc ? <img alt={image.imageAltText ?? ''} src={image.imageSrc} /> : null}{image?.imageCaption ? <figcaption>{image.imageCaption}</figcaption> : null}</figure> }
  if (section.sectionType === 'note') { const note = section.rows.find((block) => block.blockType === 'note'); return <aside className="native-pattern-view-note" style={blockStyle(resolveNativeBlockStyle(note?.designStyle, sectionStyle))}>{note?.instruction}</aside> }
  let rowNumber = rowNumberStart
  return <section className="native-pattern-view-section" style={blockStyle(sectionStyle)}>
    <header><span>Section</span><h2>{section.title}</h2>{section.notes ? <p>{section.notes}</p> : null}</header>
    <div className="native-pattern-view-blocks">
      {section.rows.map((block) => {
        const resolvedStyle = resolveNativeBlockStyle(block.designStyle, sectionStyle)
        if (block.blockType === 'note') return <aside className="native-pattern-view-note" key={block.id} style={blockStyle(resolvedStyle)}>{block.instruction}</aside>
        if (block.blockType === 'image') return <figure className="native-pattern-view-image" key={block.id} style={blockStyle(resolvedStyle)}>{block.imageSrc ? <img alt={block.imageAltText ?? ''} src={block.imageSrc} /> : null}{block.imageCaption ? <figcaption>{block.imageCaption}</figcaption> : null}</figure>
        if (block.blockType === 'text') return <div className="native-pattern-view-text" key={block.id} style={blockStyle(resolvedStyle)}>{block.blockHeading ? <h3>{block.blockHeading}</h3> : null}{block.instruction ? <p>{block.instruction}</p> : null}</div>
        if (block.rowType !== 'chain' && block.rowType !== 'magic-ring') rowNumber += 1
        const label = block.rowType === 'chain' ? 'Chain' : block.rowType === 'magic-ring' ? 'Magic ring' : `${block.rowType === 'round' ? 'Round' : 'Row'} ${rowNumber}`
        const color = colors.find((item) => item.key === block.colorKey)
        const completed = completedRowIds.has(block.id)
        return <div className={`native-pattern-view-row ${completed ? 'completed' : ''}`} key={block.id} style={blockStyle(resolvedStyle)}>
          <button aria-label={completed ? `Mark ${label} incomplete` : `Mark ${label} complete`} aria-pressed={completed} className="native-row-check" onClick={(event) => { event.stopPropagation(); onToggleRow?.(block.id, !completed) }} type="button"><span /></button>
          <strong>{label}</strong><p>{block.instruction}</p>
          {color ? <span className="native-pattern-row-color"><i style={{ backgroundColor: colorOverrides[color.id] ?? color.hexColor ?? '#C78AA8' }} />{color.key}</span> : <span />}
          {pattern.style.showStitchCounts ? <small>{block.computedStitchCount === null ? '' : `[${block.computedStitchCount}]`}</small> : null}
        </div>
      })}
    </div>
  </section>
}

function countNumberedRows(section: RenderedNativeSection) {
  return section.rows.filter((block) => block.blockType === 'row' && block.rowType !== 'chain' && block.rowType !== 'magic-ring').length
}

export function NativePatternBackground({ backgroundColor, color, opacity, pattern }: { backgroundColor: string; color: string; opacity: number; pattern: NativePatternStyle['backgroundPattern'] }) {
  if (pattern === 'none') return null
  return <div aria-hidden="true" className="native-svg-pattern" style={heroBackgroundStyle(pattern, color, backgroundColor, opacity)} />
}

function blockStyle(value?: NativeBlockStyle) {
  const style = value ?? defaultNativeBlockStyle
  return {
    backgroundColor: style.backgroundColor,
    color: style.textColor,
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    borderStyle: style.borderWidth ? 'solid' : 'none',
    borderRadius: style.borderRadius,
    padding: style.padding,
    textAlign: style.textAlign,
    float: style.float === 'none' ? undefined : style.float,
  } as CSSProperties
}

function widgetGridStyle(widget: NativeGridItem) {
  return {
    gridColumn: `${widget.x + 1} / span ${widget.w}`,
    gridRow: `${widget.y + 1} / span ${widget.h}`,
  } as CSSProperties
}
