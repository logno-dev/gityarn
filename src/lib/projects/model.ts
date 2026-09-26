export const projectStatuses = ['planned', 'active', 'paused', 'completed', 'archived'] as const
export type ProjectStatus = typeof projectStatuses[number]

export type ProjectStepPattern = {
  id: string
  title: string
  sourceUrl: string | null
  patternType: string
  hasPdf: boolean
}

export type ProjectStep = {
  id: string
  title: string
  notes: string | null
  dueDate: string | null
  completedAt: number | null
  sortOrder: number
  patterns: ProjectStepPattern[]
}

export type ProjectDetail = {
  id: string
  name: string
  status: ProjectStatus
  notes: string | null
  startDate: string | null
  dueDate: string | null
  completedAt: number | null
  createdAt: number
  updatedAt: number
  steps: ProjectStep[]
  yarn: Array<{
    inventoryId: string
    label: string
    skeinsPlanned: number
  }>
  hooks: Array<{
    hookId: string
    label: string
  }>
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && projectStatuses.includes(value as ProjectStatus)
}

export function normalizeProjectDate(value: unknown): string | null {
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null
}

export function buildProjectCreationNotes(project: Pick<ProjectDetail, 'steps'>, publicNotes: string) {
  const sections = [publicNotes.trim()].filter(Boolean)
  const milestones = project.steps.map((step) => {
    const marker = step.completedAt ? '[x]' : '[ ]'
    const due = step.dueDate ? ` - due ${step.dueDate}` : ''
    return `${marker} ${step.title}${due}`
  })
  if (milestones.length) sections.push(`Project milestones\n${milestones.join('\n')}`)
  return sections.join('\n\n') || null
}
