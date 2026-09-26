import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { projects, projectSteps } from '#/lib/db/schema'
import { isProjectStatus, normalizeProjectDate } from '#/lib/projects/model'

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const query = new URL(request.url).searchParams.get('query')?.trim().toLowerCase() ?? ''
        const where = query
          ? and(eq(projects.userId, authUser.id), sql`lower(${projects.name}) like ${`%${query}%`}`)
          : eq(projects.userId, authUser.id)
        const rows = await getDb().select().from(projects).where(where).orderBy(desc(projects.updatedAt))
        const projectIds = rows.map((project) => project.id)
        const steps = projectIds.length
          ? await getDb().select({ projectId: projectSteps.projectId, dueDate: projectSteps.dueDate, completedAt: projectSteps.completedAt }).from(projectSteps).where(inArray(projectSteps.projectId, projectIds)).orderBy(asc(projectSteps.sortOrder))
          : []
        const stepsByProject = new Map<string, typeof steps>()
        for (const step of steps) stepsByProject.set(step.projectId, [...(stepsByProject.get(step.projectId) ?? []), step])

        return Response.json({
          projects: rows.map((project) => {
            const projectStepRows = stepsByProject.get(project.id) ?? []
            return {
              ...project,
              stepCount: projectStepRows.length,
              completedStepCount: projectStepRows.filter((step) => step.completedAt).length,
              nextDueDate: projectStepRows.filter((step) => !step.completedAt && step.dueDate).map((step) => step.dueDate as string).sort()[0] ?? null,
            }
          }),
        })
      },
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const body = await request.json().catch(() => null) as Record<string, unknown> | null
        if (!body) return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })

        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
        const status = isProjectStatus(body.status) ? body.status : 'planned'
        const startDate = normalizeProjectDate(body.startDate)
        const dueDate = normalizeProjectDate(body.dueDate)
        if (!name || name.length > 200) return Response.json({ message: 'Project name is required and must be 200 characters or fewer.' }, { status: 400 })
        if (notes && notes.length > 10000) return Response.json({ message: 'Project notes must be 10,000 characters or fewer.' }, { status: 400 })
        if (body.startDate && !startDate) return Response.json({ message: 'Start date is invalid.' }, { status: 400 })
        if (body.dueDate && !dueDate) return Response.json({ message: 'Due date is invalid.' }, { status: 400 })

        const projectId = crypto.randomUUID()
        await getDb().insert(projects).values({
          id: projectId,
          userId: authUser.id,
          name,
          status,
          notes,
          startDate,
          dueDate,
          completedAt: status === 'completed' ? Date.now() : null,
        })
        return Response.json({ message: 'Project created.', projectId }, { status: 201 })
      },
    },
  },
})
