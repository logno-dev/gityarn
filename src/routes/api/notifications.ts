import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { notifications, users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/notifications')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const db = getDb()
        const rows = await db
          .select({
            id: notifications.id,
            type: notifications.type,
            message: notifications.message,
            entityType: notifications.entityType,
            entityId: notifications.entityId,
            targetPath: notifications.targetPath,
            readAt: notifications.readAt,
            createdAt: notifications.createdAt,
            actorDisplayName: users.displayName,
          })
          .from(notifications)
          .leftJoin(users, eq(notifications.actorUserId, users.id))
          .where(eq(notifications.userId, authUser.id))
          .orderBy(desc(notifications.createdAt))
          .limit(120)

        const [unreadRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(notifications)
          .where(and(eq(notifications.userId, authUser.id), isNull(notifications.readAt)))

        return Response.json(
          {
            unreadCount: Number(unreadRow?.count) || 0,
            items: rows,
          },
          { status: 200 },
        )
      },
      PATCH: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const body = (await request.json()) as { id?: string; markAll?: boolean }
        const now = Date.now()

        if (body.markAll) {
          await getDb()
            .update(notifications)
            .set({ readAt: now, updatedAt: now })
            .where(and(eq(notifications.userId, authUser.id), isNull(notifications.readAt)))
          return Response.json({ message: 'All notifications marked as read.' }, { status: 200 })
        }

        const id = body.id?.trim() ?? ''
        if (!id) return Response.json({ message: 'id is required.' }, { status: 400 })

        await getDb()
          .update(notifications)
          .set({ readAt: now, updatedAt: now })
          .where(and(eq(notifications.id, id), eq(notifications.userId, authUser.id)))

        return Response.json({ message: 'Notification marked as read.' }, { status: 200 })
      },
    },
  },
})
