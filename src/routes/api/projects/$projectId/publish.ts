import { and, asc, eq, inArray } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { creationHooks, creationPatterns, creations, creationYarn, projectHooks, projects, projectStepPatterns, projectSteps, projectYarn } from '#/lib/db/schema'
import { buildProjectCreationNotes } from '#/lib/projects/model'

export const Route = createFileRoute('/api/projects/$projectId/publish')({
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

        const name = typeof body.name === 'string' ? body.name.trim() : `${project.name} update`
        const publicNotes = typeof body.notes === 'string' ? body.notes : ''
        const postType = body.postType === 'completed' ? 'completed' : 'progress'
        const isPublic = typeof body.isPublic === 'boolean' ? body.isPublic : true
        if (!name || name.length > 200) return Response.json({ message: 'Post name is required and must be 200 characters or fewer.' }, { status: 400 })
        if (publicNotes.length > 10000) return Response.json({ message: 'Post notes must be 10,000 characters or fewer.' }, { status: 400 })

        const steps = await db.select().from(projectSteps).where(eq(projectSteps.projectId, project.id)).orderBy(asc(projectSteps.sortOrder), asc(projectSteps.createdAt))
        const stepIds = steps.map((step) => step.id)
        const patternLinks = stepIds.length ? await db.select().from(projectStepPatterns).where(inArray(projectStepPatterns.stepId, stepIds)).orderBy(asc(projectStepPatterns.sortOrder)) : []
        const patternIds = [...new Set(patternLinks.map((link) => link.patternId))]
        const yarnLinks = await db.select().from(projectYarn).where(eq(projectYarn.projectId, project.id))
        const hookLinks = await db.select().from(projectHooks).where(eq(projectHooks.projectId, project.id))
        const yarnUsage = parseYarnUsage(body.yarnUsage)
        const projectYarnIds = new Set(yarnLinks.map((link) => link.inventoryYarnId))
        if (yarnUsage.length !== yarnLinks.length || yarnUsage.some((item) => !projectYarnIds.has(item.inventoryYarnId))) {
          return Response.json({ message: 'Report the skeins used for each project yarn before publishing.' }, { status: 400 })
        }
        const notes = buildProjectCreationNotes({ steps: steps.map((step) => ({ ...step, patterns: [] })) }, publicNotes)
        const creationId = crypto.randomUUID()
        const now = Date.now()

        await db.transaction(async (tx) => {
          await tx.insert(creations).values({
            id: creationId,
            userId: authUser.id,
            projectId: project.id,
            patternId: patternIds[0] ?? null,
            name,
            status: postType === 'completed' ? 'finished' : 'active',
            postType,
            isPublic,
            notes,
            finishedAt: postType === 'completed' ? now : null,
          })
          if (patternIds.length) await tx.insert(creationPatterns).values(patternIds.map((patternId, sortOrder) => ({ creationId, patternId, sortOrder })))
          if (yarnUsage.length) await tx.insert(creationYarn).values(yarnUsage.map((item) => ({ creationId, ...item })))
          if (hookLinks.length) await tx.insert(creationHooks).values(hookLinks.map((link) => ({ creationId, hookId: link.hookId })))
        })

        return Response.json({ message: isPublic ? 'Project update published.' : 'Creation draft saved.', creationId }, { status: 201 })
      },
    },
  },
})

function parseYarnUsage(value: unknown) {
  if (!Array.isArray(value)) return []
  const parsed = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const input = item as Record<string, unknown>
    const inventoryYarnId = typeof input.inventoryYarnId === 'string' ? input.inventoryYarnId.trim() : ''
    const skeinsUsed = Number(input.skeinsUsed)
    return inventoryYarnId && Number.isInteger(skeinsUsed) && skeinsUsed > 0 && skeinsUsed <= 999 ? [{ inventoryYarnId, skeinsUsed }] : []
  })
  return [...new Map(parsed.map((item) => [item.inventoryYarnId, item])).values()]
}
