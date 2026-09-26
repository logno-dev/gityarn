import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { nativePatternRowProgress, nativePatternRows, patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId/native-progress')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const access = await getPatternAccess(request, params.patternId)
        if (access.response) return access.response
        const rows = await getDb().select({ rowId: nativePatternRowProgress.rowId }).from(nativePatternRowProgress).where(and(
          eq(nativePatternRowProgress.userId, access.userId),
          eq(nativePatternRowProgress.patternId, params.patternId),
          eq(nativePatternRowProgress.completed, true),
        ))
        return Response.json({ completedRowIds: rows.map((row) => row.rowId) })
      },
      PATCH: async ({ request, params }) => {
        const access = await getPatternAccess(request, params.patternId)
        if (access.response) return access.response
        const body = await request.json().catch(() => null) as { rowId?: unknown; completed?: unknown } | null
        if (!body || typeof body.rowId !== 'string' || typeof body.completed !== 'boolean') {
          return Response.json({ message: 'rowId and completed are required.' }, { status: 400 })
        }
        const row = await getDb().query.nativePatternRows.findFirst({ where: and(
          eq(nativePatternRows.id, body.rowId),
          eq(nativePatternRows.patternId, params.patternId),
          eq(nativePatternRows.blockType, 'row'),
        ) })
        if (!row) return Response.json({ message: 'Pattern row not found.' }, { status: 404 })
        if (body.completed) {
          const now = Date.now()
          await getDb().insert(nativePatternRowProgress).values({
            userId: access.userId,
            patternId: params.patternId,
            rowId: row.id,
            completed: true,
            createdAt: now,
            updatedAt: now,
          }).onConflictDoUpdate({
            target: [nativePatternRowProgress.userId, nativePatternRowProgress.patternId, nativePatternRowProgress.rowId],
            set: { completed: true, updatedAt: now },
          })
        } else {
          await getDb().delete(nativePatternRowProgress).where(and(
            eq(nativePatternRowProgress.userId, access.userId),
            eq(nativePatternRowProgress.patternId, params.patternId),
            eq(nativePatternRowProgress.rowId, row.id),
          ))
        }
        return Response.json({ rowId: row.id, completed: body.completed })
      },
    },
  },
})

async function getPatternAccess(request: Request, patternId: string): Promise<
  { userId: string; response?: undefined } | { userId: ''; response: Response }
> {
  const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
  if (!authUser) return { userId: '', response: Response.json({ message: 'Unauthorized' }, { status: 401 }) }
  const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, patternId) })
  if (!pattern || pattern.patternType !== 'native' || (pattern.userId !== authUser.id && (!pattern.isPublic || pattern.moderationStatus !== 'active'))) {
    return { userId: '', response: Response.json({ message: 'Pattern not found.' }, { status: 404 }) }
  }
  return { userId: authUser.id }
}
