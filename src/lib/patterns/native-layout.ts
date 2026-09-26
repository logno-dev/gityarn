export const nativeWidgetKinds = ['cover', 'palette', 'section', 'text', 'image', 'note', 'heading', 'divider', 'spacer'] as const
export const nativeSectionTypes = ['pattern', 'text', 'image', 'note', 'heading', 'divider', 'spacer'] as const

export type NativeWidgetKind = typeof nativeWidgetKinds[number]
export type NativeSectionType = typeof nativeSectionTypes[number]

export type NativeGridItem = {
  i: string
  kind: NativeWidgetKind
  sectionId: string | null
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export type NativeLayoutSection = {
  id: string
  sectionType: string
  rows: Array<unknown>
}

export function normalizeNativeGridLayout(value: unknown): NativeGridItem[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0, 100).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const i = typeof item.i === 'string' && item.i.length <= 100 ? item.i : ''
    const kind = nativeWidgetKinds.includes(item.kind as NativeWidgetKind) ? item.kind as NativeWidgetKind : null
    if (!i || !kind || seen.has(i)) return []
    seen.add(i)
    const w = integer(item.w, 1, 12, 12)
    return [{
      i,
      kind,
      sectionId: typeof item.sectionId === 'string' ? item.sectionId : null,
      x: integer(item.x, 0, 12 - w, 0),
      y: integer(item.y, 0, 10_000, 0),
      w,
      h: integer(item.h, 1, 100, defaultWidgetHeight(kind)),
      minW: 2,
      minH: 1,
    }]
  })
}

export function reconcileNativeGridLayout(value: unknown, sections: NativeLayoutSection[], hasColors: boolean) {
  const normalized = normalizeNativeGridLayout(value)
  const sectionsById = new Map(sections.map((section) => [section.id, section]))
  const result: NativeGridItem[] = []
  const representedSections = new Set<string>()
  let hasCover = false
  let hasPalette = false

  for (const item of normalized) {
    if (item.kind === 'cover') {
      if (hasCover) continue
      hasCover = true
      result.push({ ...item, i: 'cover', sectionId: null })
      continue
    }
    if (item.kind === 'palette') {
      if (hasPalette || !hasColors) continue
      hasPalette = true
      result.push({ ...item, i: 'palette', sectionId: null })
      continue
    }
    if (!item.sectionId || representedSections.has(item.sectionId)) continue
    const section = sectionsById.get(item.sectionId)
    if (!section) continue
    representedSections.add(section.id)
    result.push({ ...item, i: `section-${section.id}`, kind: widgetKindForSection(section.sectionType), sectionId: section.id })
  }

  let nextY = result.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0)
  if (!hasCover) {
    result.unshift({ i: 'cover', kind: 'cover', sectionId: null, x: 0, y: 0, w: 12, h: 10, minW: 4, minH: 4 })
    nextY = Math.max(nextY, 10)
  }
  if (hasColors && !hasPalette) {
    result.push({ i: 'palette', kind: 'palette', sectionId: null, x: 0, y: nextY, w: 12, h: 3, minW: 4, minH: 2 })
    nextY += 3
  }
  for (const section of sections) {
    if (representedSections.has(section.id)) continue
    const kind = widgetKindForSection(section.sectionType)
    const height = kind === 'section' ? Math.max(4, Math.min(14, section.rows.length + 3)) : defaultWidgetHeight(kind)
    result.push({ i: `section-${section.id}`, kind, sectionId: section.id, x: 0, y: nextY, w: 12, h: height, minW: 2, minH: 1 })
    nextY += height
  }
  return result
}

export function mergeNativeGridPositions(items: NativeGridItem[], positions: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) {
  const positionsById = new Map(positions.map((item) => [item.i, item]))
  return items.map((item) => {
    const position = positionsById.get(item.i)
    return position ? { ...item, x: position.x, y: position.y, w: position.w, h: position.h } : item
  })
}

export function widgetKindForSection(sectionType: string): NativeWidgetKind {
  return nativeWidgetKinds.includes(sectionType as NativeWidgetKind) && sectionType !== 'cover' && sectionType !== 'palette'
    ? sectionType as NativeWidgetKind
    : 'section'
}

export function normalizeNativeSectionType(value: unknown): NativeSectionType {
  return nativeSectionTypes.includes(value as NativeSectionType) ? value as NativeSectionType : 'pattern'
}

export function defaultWidgetHeight(kind: NativeWidgetKind) {
  if (kind === 'cover') return 10
  if (kind === 'palette') return 3
  if (kind === 'image') return 6
  if (kind === 'spacer') return 2
  if (kind === 'divider' || kind === 'heading') return 2
  return 4
}

function integer(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback
}
