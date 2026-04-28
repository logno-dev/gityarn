import { asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { creations } from '#/lib/db/schema'

export const Route = createFileRoute('/api/share/options')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const rows = await getDb()
          .select({
            id: creations.id,
            name: creations.name,
            status: creations.status,
            updatedAt: creations.updatedAt,
          })
          .from(creations)
          .where(eq(creations.userId, authUser.id))
          .orderBy(asc(creations.name))

        return Response.json({ creations: rows }, { status: 200 })
      },
    },
  },
})
