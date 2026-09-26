import { describe, expect, it } from 'vitest'

import { mergeNativeGridPositions, normalizeNativeGridLayout, reconcileNativeGridLayout } from './native-layout'

const sections = [
  { id: 'first', sectionType: 'pattern', rows: [{}, {}] },
  { id: 'note', sectionType: 'note', rows: [{}] },
]

describe('native pattern grid layout', () => {
  it('creates a full-width compatible layout for an existing pattern', () => {
    const layout = reconcileNativeGridLayout([], sections, true)
    expect(layout.map((item) => item.i)).toEqual(['cover', 'palette', 'section-first', 'section-note'])
    expect(layout.every((item) => item.w === 12)).toBe(true)
  })

  it('preserves valid freeform positions and sizes', () => {
    const layout = reconcileNativeGridLayout([
      { i: 'section-first', kind: 'section', sectionId: 'first', x: 7, y: 12, w: 5, h: 9 },
    ], sections.slice(0, 1), false)
    expect(layout.find((item) => item.i === 'section-first')).toMatchObject({ x: 7, y: 12, w: 5, h: 9 })
  })

  it('clamps widgets to the 12-column canvas', () => {
    expect(normalizeNativeGridLayout([{ i: 'a', kind: 'text', sectionId: 'a', x: 11, y: -2, w: 8, h: 0 }])[0]).toMatchObject({ x: 4, y: 0, w: 8, h: 1 })
  })

  it('drops duplicate and dangling section widgets', () => {
    const layout = reconcileNativeGridLayout([
      { i: 'one', kind: 'section', sectionId: 'first', x: 0, y: 0, w: 6, h: 4 },
      { i: 'two', kind: 'section', sectionId: 'first', x: 6, y: 0, w: 6, h: 4 },
      { i: 'missing', kind: 'section', sectionId: 'missing', x: 0, y: 4, w: 12, h: 4 },
    ], sections.slice(0, 1), false)
    expect(layout.filter((item) => item.sectionId === 'first')).toHaveLength(1)
    expect(layout.some((item) => item.sectionId === 'missing')).toBe(false)
  })

  it('does not remove a newly added widget when the grid reports stale positions', () => {
    const layout = reconcileNativeGridLayout([], sections, false)
    const newWidget = { i: 'section-new', kind: 'text' as const, sectionId: 'new', x: 6, y: 20, w: 6, h: 4, minW: 2, minH: 1 }
    const merged = mergeNativeGridPositions([...layout, newWidget], layout.map((item) => ({ ...item, y: item.y + 1 })))
    expect(merged.find((item) => item.i === newWidget.i)).toEqual(newWidget)
    expect(merged.find((item) => item.i === 'cover')?.y).toBe(1)
  })
})
