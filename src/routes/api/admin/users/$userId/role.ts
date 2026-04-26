import { eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/admin/users/$userId/role')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }
        if (authUser.role !== 'admin') {
          return Response.json({ message: 'Forbidden' }, { status: 403 })
        }

        const body = (await request.json()) as { role?: 'member' | 'admin' }
        if (body.role !== 'member' && body.role !== 'admin') {
          return Response.json({ message: 'Role must be member or admin.' }, { status: 400 })
        }

        const db = getDb()
        const targetUser = await db.query.users.findFirst({ where: eq(users.id, params.userId) })
        if (!targetUser) {
          return Response.json({ message: 'User not found.' }, { status: 404 })
        }

        const [adminCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.role, 'admin'))
        const adminCount = Number(adminCountRow?.count) || 0

        if (targetUser.id === authUser.id && targetUser.role === 'admin' && body.role === 'member' && adminCount <= 1) {
          return Response.json({ message: 'Cannot remove the only remaining admin.' }, { status: 400 })
        }

        await db
          .update(users)
          .set({
            role: body.role,
            updatedAt: Date.now(),
          })
          .where(eq(users.id, params.userId))

        return Response.json({ message: 'User role updated.' }, { status: 200 })
      },
    },
  },
})
