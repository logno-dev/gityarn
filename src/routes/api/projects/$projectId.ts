import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { hooks, inventoryYarn, manufacturers, patterns, projectHooks, projects, projectStepPatterns, projectSteps, projectYarn, yarnColorways, yarnLines } from '#/lib/db/schema'
import { isProjectStatus, normalizeProjectDate } from '#/lib/projects/model'

export const Route = createFileRoute('/api/projects/$projectId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const db = getDb()
        const project = await db.query.projects.findFirst({ where: and(eq(projects.id, params.projectId), eq(projects.userId, authUser.id)) })
        if (!project) return Response.json({ message: 'Project not found.' }, { status: 404 })

        const steps = await db.select().from(projectSteps).where(eq(projectSteps.projectId, project.id)).orderBy(asc(projectSteps.sortOrder), asc(projectSteps.createdAt))
        const stepIds = steps.map((step) => step.id)
        const patternRows = stepIds.length
          ? await db.select({ stepId: projectStepPatterns.stepId, sortOrder: projectStepPatterns.sortOrder, id: patterns.id, title: patterns.title, sourceUrl: patterns.sourceUrl, patternType: patterns.patternType, hasPdf: sql<boolean>`case when ${patterns.pdfR2Key} is not null then 1 else 0 end` }).from(projectStepPatterns).innerJoin(patterns, eq(projectStepPatterns.patternId, patterns.id)).where(inArray(projectStepPatterns.stepId, stepIds)).orderBy(asc(projectStepPatterns.sortOrder))
          : []
        const patternsByStep = new Map<string, typeof patternRows>()
        for (const pattern of patternRows) patternsByStep.set(pattern.stepId, [...(patternsByStep.get(pattern.stepId) ?? []), pattern])

        const yarn = await db.select({ inventoryId: inventoryYarn.id, nickname: inventoryYarn.nickname, lineName: yarnLines.name, manufacturerName: manufacturers.name, colorwayName: yarnColorways.name, skeinsPlanned: projectYarn.skeinsPlanned }).from(projectYarn).innerJoin(inventoryYarn, eq(projectYarn.inventoryYarnId, inventoryYarn.id)).leftJoin(yarnLines, eq(inventoryYarn.yarnLineId, yarnLines.id)).leftJoin(manufacturers, eq(yarnLines.manufacturerId, manufacturers.id)).leftJoin(yarnColorways, eq(inventoryYarn.yarnColorwayId, yarnColorways.id)).where(eq(projectYarn.projectId, project.id))
        const projectHookRows = await db.select({ hookId: hooks.id, sizeLabel: hooks.sizeLabel, metricSizeMm: hooks.metricSizeMm, material: hooks.material }).from(projectHooks).innerJoin(hooks, eq(projectHooks.hookId, hooks.id)).where(eq(projectHooks.projectId, project.id))

        return Response.json({
          project: {
            ...project,
            steps: steps.map((step) => ({ ...step, patterns: (patternsByStep.get(step.id) ?? []).map(({ stepId: _stepId, sortOrder: _sortOrder, ...pattern }) => ({ ...pattern, hasPdf: Boolean(pattern.hasPdf) })) })),
            yarn: yarn.map((item) => ({ inventoryId: item.inventoryId, skeinsPlanned: item.skeinsPlanned, label: [item.nickname, item.manufacturerName, item.lineName, item.colorwayName].filter(Boolean).join(' · ') || 'Inventory yarn' })),
            hooks: projectHookRows.map((hook) => ({ hookId: hook.hookId, label: `${hook.sizeLabel}${hook.metricSizeMm ? ` (${hook.metricSizeMm}mm)` : ''}${hook.material ? ` · ${hook.material}` : ''}` })),
          },
        })
      },
      PATCH: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const body = await request.json().catch(() => null) as Record<string, unknown> | null
        if (!body) return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
        const db = getDb()
        const project = await db.query.projects.findFirst({ where: and(eq(projects.id, params.projectId), eq(projects.userId, authUser.id)) })
        if (!project) return Response.json({ message: 'Project not found.' }, { status: 404 })

        const update: Partial<typeof projects.$inferInsert> = { updatedAt: Date.now() }
        if ('name' in body) {
          const name = typeof body.name === 'string' ? body.name.trim() : ''
          if (!name || name.length > 200) return Response.json({ message: 'Project name is required and must be 200 characters or fewer.' }, { status: 400 })
          update.name = name
        }
        if ('notes' in body) {
          const notes = typeof body.notes === 'string' ? body.notes.trim() || null : body.notes === null ? null : undefined
          if (notes === undefined || (notes && notes.length > 10000)) return Response.json({ message: 'Project notes are invalid.' }, { status: 400 })
          update.notes = notes
        }
        if ('status' in body) {
          if (!isProjectStatus(body.status)) return Response.json({ message: 'Project status is invalid.' }, { status: 400 })
          update.status = body.status
          update.completedAt = body.status === 'completed' ? project.completedAt ?? Date.now() : null
        }
        for (const field of ['startDate', 'dueDate'] as const) {
          if (!(field in body)) continue
          const date = normalizeProjectDate(body[field])
          if (body[field] && !date) return Response.json({ message: `${field === 'startDate' ? 'Start' : 'Due'} date is invalid.` }, { status: 400 })
          update[field] = date
        }

        const yarnIds = 'yarnInventoryIds' in body ? parseIds(body.yarnInventoryIds) : null
        const hookIds = 'hookIds' in body ? parseIds(body.hookIds) : null
        if ('yarnInventoryIds' in body && yarnIds === null) return Response.json({ message: 'Yarn selections are invalid.' }, { status: 400 })
        if ('hookIds' in body && hookIds === null) return Response.json({ message: 'Hook selections are invalid.' }, { status: 400 })
        if (yarnIds?.length) {
          const owned = await db.select({ id: inventoryYarn.id }).from(inventoryYarn).where(and(eq(inventoryYarn.userId, authUser.id), inArray(inventoryYarn.id, yarnIds)))
          if (owned.length !== yarnIds.length) return Response.json({ message: 'One or more yarn selections are unavailable.' }, { status: 400 })
        }
        if (hookIds?.length) {
          const owned = await db.select({ id: hooks.id }).from(hooks).where(and(eq(hooks.userId, authUser.id), inArray(hooks.id, hookIds)))
          if (owned.length !== hookIds.length) return Response.json({ message: 'One or more hook selections are unavailable.' }, { status: 400 })
        }

        await db.transaction(async (tx) => {
          await tx.update(projects).set(update).where(and(eq(projects.id, project.id), eq(projects.userId, authUser.id)))
          if (yarnIds) {
            await tx.delete(projectYarn).where(eq(projectYarn.projectId, project.id))
            if (yarnIds.length) await tx.insert(projectYarn).values(yarnIds.map((inventoryYarnId) => ({ projectId: project.id, inventoryYarnId })))
          }
          if (hookIds) {
            await tx.delete(projectHooks).where(eq(projectHooks.projectId, project.id))
            if (hookIds.length) await tx.insert(projectHooks).values(hookIds.map((hookId) => ({ projectId: project.id, hookId })))
          }
        })
        return Response.json({ message: 'Project updated.' })
      },
      DELETE: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const db = getDb()
        const project = await db.query.projects.findFirst({ where: and(eq(projects.id, params.projectId), eq(projects.userId, authUser.id)) })
        if (!project) return Response.json({ message: 'Project not found.' }, { status: 404 })
        await db.delete(projects).where(and(eq(projects.id, project.id), eq(projects.userId, authUser.id)))
        return Response.json({ message: 'Project removed.' })
      },
    },
  },
})

function parseIds(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))]
}
