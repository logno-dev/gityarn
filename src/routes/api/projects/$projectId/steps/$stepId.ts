import { and, eq, inArray, or } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { patternLibraryLinks, patterns, projects, projectStepPatterns, projectSteps } from '#/lib/db/schema'
import { normalizeProjectDate } from '#/lib/projects/model'

export const Route = createFileRoute('/api/projects/$projectId/steps/$stepId')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const body = await request.json().catch(() => null) as Record<string, unknown> | null
        if (!body) return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
        const owned = await getOwnedStep(params.projectId, params.stepId, authUser.id)
        if (!owned) return Response.json({ message: 'Milestone not found.' }, { status: 404 })

        const update: Partial<typeof projectSteps.$inferInsert> = { updatedAt: Date.now() }
        if ('title' in body) {
          const title = typeof body.title === 'string' ? body.title.trim() : ''
          if (!title || title.length > 200) return Response.json({ message: 'Milestone title is required and must be 200 characters or fewer.' }, { status: 400 })
          update.title = title
        }
        if ('notes' in body) {
          const notes = typeof body.notes === 'string' ? body.notes.trim() || null : body.notes === null ? null : undefined
          if (notes === undefined || (notes && notes.length > 5000)) return Response.json({ message: 'Milestone notes are invalid.' }, { status: 400 })
          update.notes = notes
        }
        if ('dueDate' in body) {
          const dueDate = normalizeProjectDate(body.dueDate)
          if (body.dueDate && !dueDate) return Response.json({ message: 'Due date is invalid.' }, { status: 400 })
          update.dueDate = dueDate
        }
        if ('completed' in body) {
          if (typeof body.completed !== 'boolean') return Response.json({ message: 'Completed state is invalid.' }, { status: 400 })
          update.completedAt = body.completed ? owned.step.completedAt ?? Date.now() : null
        }

        const patternIds = 'patternIds' in body ? parseIds(body.patternIds) : null
        if ('patternIds' in body && patternIds === null) return Response.json({ message: 'Pattern selections are invalid.' }, { status: 400 })
        if (patternIds && !(await canAccessPatterns(patternIds, authUser.id))) return Response.json({ message: 'One or more patterns are unavailable.' }, { status: 400 })

        const db = getDb()
        await db.transaction(async (tx) => {
          await tx.update(projectSteps).set(update).where(and(eq(projectSteps.id, owned.step.id), eq(projectSteps.projectId, owned.project.id)))
          if (patternIds) {
            await tx.delete(projectStepPatterns).where(eq(projectStepPatterns.stepId, owned.step.id))
            if (patternIds.length) await tx.insert(projectStepPatterns).values(patternIds.map((patternId, sortOrder) => ({ stepId: owned.step.id, patternId, sortOrder })))
          }
          await tx.update(projects).set({ updatedAt: Date.now() }).where(eq(projects.id, owned.project.id))
        })
        return Response.json({ message: 'Milestone updated.' })
      },
      DELETE: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const owned = await getOwnedStep(params.projectId, params.stepId, authUser.id)
        if (!owned) return Response.json({ message: 'Milestone not found.' }, { status: 404 })
        const db = getDb()
        await db.transaction(async (tx) => {
          await tx.delete(projectSteps).where(and(eq(projectSteps.id, owned.step.id), eq(projectSteps.projectId, owned.project.id)))
          await tx.update(projects).set({ updatedAt: Date.now() }).where(eq(projects.id, owned.project.id))
        })
        return Response.json({ message: 'Milestone removed.' })
      },
    },
  },
})

async function getOwnedStep(projectId: string, stepId: string, userId: string) {
  const db = getDb()
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.userId, userId)) })
  if (!project) return null
  const step = await db.query.projectSteps.findFirst({ where: and(eq(projectSteps.id, stepId), eq(projectSteps.projectId, project.id)) })
  return step ? { project, step } : null
}

async function canAccessPatterns(patternIds: string[], userId: string) {
  if (!patternIds.length) return true
  const rows = await getDb().select({ id: patterns.id }).from(patterns).leftJoin(patternLibraryLinks, and(eq(patternLibraryLinks.patternId, patterns.id), eq(patternLibraryLinks.userId, userId))).where(and(inArray(patterns.id, patternIds), or(eq(patterns.userId, userId), eq(patternLibraryLinks.userId, userId))))
  return new Set(rows.map((row) => row.id)).size === patternIds.length
}

function parseIds(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))]
}
