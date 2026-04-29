import { and, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { creationHearts, creations } from '#/lib/db/schema'

export const Route = createFileRoute('/api/creations/$creationId/hearts')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const db = getDb()
        const creation = await db.query.creations.findFirst({ where: eq(creations.id, params.creationId) })
        if (!creation) return Response.json({ message: 'Creation not found.' }, { status: 404 })

        const existing = await db.query.creationHearts.findFirst({
          where: and(eq(creationHearts.creationId, creation.id), eq(creationHearts.userId, authUser.id)),
        })

        if (existing) {
          await db
            .delete(creationHearts)
            .where(and(eq(creationHearts.creationId, creation.id), eq(creationHearts.userId, authUser.id)))
          const [countRow] = await db
            .select({ count: sql<number>`count(*)` })
            .from(creationHearts)
            .where(eq(creationHearts.creationId, creation.id))
          return Response.json({ viewerHasHeart: false, heartCount: Number(countRow?.count) || 0 }, { status: 200 })
        }

        await db.insert(creationHearts).values({
          creationId: creation.id,
          userId: authUser.id,
          createdAt: Date.now(),
        })
        const [countRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(creationHearts)
          .where(eq(creationHearts.creationId, creation.id))
        return Response.json({ viewerHasHeart: true, heartCount: Number(countRow?.count) || 0 }, { status: 201 })
      },
    },
  },
})
