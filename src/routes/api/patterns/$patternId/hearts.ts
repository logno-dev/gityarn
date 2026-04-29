import { and, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { patternHearts, patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId/hearts')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const db = getDb()
        const pattern = await db.query.patterns.findFirst({ where: eq(patterns.id, params.patternId) })
        if (!pattern) return Response.json({ message: 'Pattern not found.' }, { status: 404 })

        const existing = await db.query.patternHearts.findFirst({ where: and(eq(patternHearts.patternId, pattern.id), eq(patternHearts.userId, authUser.id)) })
        if (existing) {
          await db.delete(patternHearts).where(and(eq(patternHearts.patternId, pattern.id), eq(patternHearts.userId, authUser.id)))
          const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(patternHearts).where(eq(patternHearts.patternId, pattern.id))
          return Response.json({ viewerHasHeart: false, heartCount: Number(countRow?.count) || 0 }, { status: 200 })
        }

        await db.insert(patternHearts).values({ patternId: pattern.id, userId: authUser.id, createdAt: Date.now() })
        const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(patternHearts).where(eq(patternHearts.patternId, pattern.id))
        return Response.json({ viewerHasHeart: true, heartCount: Number(countRow?.count) || 0 }, { status: 201 })
      },
    },
  },
})
