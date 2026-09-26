import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { patternLibraryLinks, patterns, projects, projectStepPatterns, projectSteps } from '#/lib/db/schema'
import { normalizeProjectDate } from '#/lib/projects/model'

export const Route = createFileRoute('/api/projects/$projectId/steps')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const body = await request.json().catch(() => null) as Record<string, unknown> | null
        if (!body) return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
        const db = getDb()
        const project = await db.query.projects.findFirst({ where: and(eq(projects.id, params.projectId), eq(projects.userId, authUser.id)) })
        if (!project) return Response.json({ message: 'Project not found.' }, { status: 404 })

        const title = typeof body.title === 'string' ? body.title.trim() : ''
        const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
        const dueDate = normalizeProjectDate(body.dueDate)
        const patternIds = parseIds(body.patternIds)
        if (!title || title.length > 200) return Response.json({ message: 'Milestone title is required and must be 200 characters or fewer.' }, { status: 400 })
        if (notes && notes.length > 5000) return Response.json({ message: 'Milestone notes must be 5,000 characters or fewer.' }, { status: 400 })
        if (body.dueDate && !dueDate) return Response.json({ message: 'Due date is invalid.' }, { status: 400 })
        if (!patternIds) return Response.json({ message: 'Pattern selections are invalid.' }, { status: 400 })
        if (!(await canAccessPatterns(patternIds, authUser.id))) return Response.json({ message: 'One or more patterns are unavailable.' }, { status: 400 })

        const maxOrder = await db.select({ value: sql<number>`coalesce(max(${projectSteps.sortOrder}), -1)` }).from(projectSteps).where(eq(projectSteps.projectId, project.id)).then((rows) => Number(rows[0]?.value) || 0)
        const stepId = crypto.randomUUID()
        await db.transaction(async (tx) => {
          await tx.insert(projectSteps).values({ id: stepId, projectId: project.id, title, notes, dueDate, sortOrder: maxOrder + 1 })
          if (patternIds.length) await tx.insert(projectStepPatterns).values(patternIds.map((patternId, sortOrder) => ({ stepId, patternId, sortOrder })))
          await tx.update(projects).set({ updatedAt: Date.now() }).where(eq(projects.id, project.id))
        })
        return Response.json({ message: 'Milestone added.', stepId }, { status: 201 })
      },
    },
  },
})

async function canAccessPatterns(patternIds: string[], userId: string) {
  if (!patternIds.length) return true
  const rows = await getDb().select({ id: patterns.id }).from(patterns).leftJoin(patternLibraryLinks, and(eq(patternLibraryLinks.patternId, patterns.id), eq(patternLibraryLinks.userId, userId))).where(and(inArray(patterns.id, patternIds), or(eq(patterns.userId, userId), eq(patternLibraryLinks.userId, userId))))
  return new Set(rows.map((row) => row.id)).size === patternIds.length
}

function parseIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))]
}
