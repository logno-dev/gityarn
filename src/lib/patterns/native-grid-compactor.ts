import type { Compactor, Layout, LayoutItem } from 'react-grid-layout'

type GridItemPosition = Pick<LayoutItem, 'i' | 'x' | 'y' | 'w' | 'h'>

export type NativeGridInteraction = {
  activeId: string
  baseline: Layout
  original: GridItemPosition | null
  external?: boolean
}

export function createNativeGridCompactor(getInteraction: () => NativeGridInteraction | null): Compactor {
  return {
    type: 'vertical',
    allowOverlap: false,
    compact(layout, cols) {
      return settleLayout(layout, cols, getInteraction())
    },
  }
}

function settleLayout(layout: Layout, cols: number, interaction: NativeGridInteraction | null) {
  const baselineById = new Map(interaction?.baseline.map((item) => [item.i, item]) ?? [])
  const restored = layout.map((item) => item.i === interaction?.activeId ? item : baselineById.get(item.i) ?? item)
  const active = interaction ? restored.find((item) => item.i === interaction.activeId) : null
  const ordered = [...restored].sort((left, right) => {
    if (left.i === active?.i) return -1
    if (right.i === active?.i) return 1
    return left.y - right.y || left.x - right.x
  })
  const settled: LayoutItem[] = []

  for (const source of ordered) {
    const item = { ...source, moved: false }
    let collisions = settled.filter((candidate) => collides(candidate, item))
    if (collisions.length && interaction?.original && item.i !== interaction.activeId) {
      const vacated = { ...item, y: interaction.original.y, x: Math.min(item.x, cols - item.w) }
      if (!settled.some((candidate) => collides(candidate, vacated))) Object.assign(item, vacated)
      collisions = settled.filter((candidate) => collides(candidate, item))
    }
    while (collisions.length) {
      item.y = Math.max(...collisions.map((candidate) => candidate.y + candidate.h))
      collisions = settled.filter((candidate) => collides(candidate, item))
    }
    settled.push(item)
  }

  const byId = new Map(settled.map((item) => [item.i, item]))
  return layout.map((item) => byId.get(item.i) ?? item)
}

function collides(left: LayoutItem, right: LayoutItem) {
  return left.i !== right.i && left.x < right.x + right.w && left.x + left.w > right.x && left.y < right.y + right.h && left.y + left.h > right.y
}
