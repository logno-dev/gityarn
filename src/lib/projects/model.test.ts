import { describe, expect, it } from 'vitest'

import { buildProjectCreationNotes, isProjectStatus, normalizeProjectDate } from './model'

describe('project model', () => {
  it('validates statuses and calendar dates', () => {
    expect(isProjectStatus('active')).toBe(true)
    expect(isProjectStatus('finished')).toBe(false)
    expect(normalizeProjectDate('2026-02-28')).toBe('2026-02-28')
    expect(normalizeProjectDate('2026-02-30')).toBeNull()
  })

  it('builds a stable Creation snapshot from project milestones', () => {
    const notes = buildProjectCreationNotes({
      steps: [
        { id: 'one', title: 'Week one', notes: null, dueDate: '2026-10-01', completedAt: 10, sortOrder: 0, patterns: [] },
        { id: 'two', title: 'Week two', notes: null, dueDate: null, completedAt: null, sortOrder: 1, patterns: [] },
      ],
    }, 'Progress is going well.')

    expect(notes).toBe('Progress is going well.\n\nProject milestones\n[x] Week one - due 2026-10-01\n[ ] Week two')
  })
})
