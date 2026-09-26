import { moveElement } from 'react-grid-layout'
import { describe, expect, it } from 'vitest'

import { createNativeGridCompactor } from './native-grid-compactor'

describe('native grid compactor', () => {
  it('preserves intentional gaps when the layout settles', () => {
    const layout = [{ i: 'first', x: 0, y: 0, w: 6, h: 2 }, { i: 'second', x: 0, y: 8, w: 6, h: 2 }]
    const compactor = createNativeGridCompactor(() => null)

    expect(compactor.compact(layout, 12).map(({ y }) => y)).toEqual([0, 8])
  })

  it('uses vertical collision movement to swap widgets while dragging', () => {
    const first = { i: 'first', x: 0, y: 0, w: 12, h: 2 }
    const second = { i: 'second', x: 0, y: 2, w: 12, h: 2 }
    const interaction = { activeId: first.i, baseline: [{ ...first }, { ...second }], original: { ...first } }
    const compactor = createNativeGridCompactor(() => interaction)
    const moved = moveElement([first, second], first, 0, 2, true, false, compactor.type, 12, false)
    const settled = compactor.compact(moved, 12)

    expect(settled.find((item) => item.i === 'first')?.y).toBe(2)
    expect(settled.find((item) => item.i === 'second')?.y).toBe(0)
  })

  it('resolves a partial edge collision before the widget is dropped', () => {
    const placed = { i: 'placed', x: 0, y: 0, w: 12, h: 4 }
    const floating = { i: 'floating', x: 0, y: 6, w: 12, h: 2 }
    const interaction = { activeId: floating.i, baseline: [{ ...placed }, { ...floating }], original: { ...floating } }
    const compactor = createNativeGridCompactor(() => interaction)
    const moved = moveElement([placed, floating], floating, 0, 3, true, false, compactor.type, 12, false)
    const settled = compactor.compact(moved, 12)
    const settledPlaced = settled.find((item) => item.i === 'placed')!
    const settledFloating = settled.find((item) => item.i === 'floating')!

    expect(settledFloating.y).toBe(3)
    expect(settledPlaced.y).toBe(6)
    expect(settledFloating.y + settledFloating.h <= settledPlaced.y).toBe(true)
  })

  it('returns displaced widgets to baseline when the active widget moves away', () => {
    const first = { i: 'first', x: 0, y: 0, w: 12, h: 2 }
    const second = { i: 'second', x: 0, y: 2, w: 12, h: 2 }
    const interaction = { activeId: first.i, baseline: [{ ...first }, { ...second }], original: { ...first } }
    const compactor = createNativeGridCompactor(() => interaction)
    const displaced = compactor.compact(moveElement([{ ...first }, { ...second }], { ...first }, 0, 2, true, false, compactor.type, 12, false), 12)
    const active = displaced.find((item) => item.i === first.i)!
    const movedAway = compactor.compact(displaced.map((item) => item.i === active.i ? { ...item, y: 6 } : item), 12)

    expect(movedAway.find((item) => item.i === second.i)?.y).toBe(2)
  })
})
