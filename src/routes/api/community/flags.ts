import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { communityFlags } from '#/lib/db/schema'
import { sendAdminModerationAlert } from '#/lib/notifications/admin-moderation'

export const Route = createFileRoute('/api/community/flags')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as {
          entityType?: string
          entityId?: string
          reason?: string
          details?: string
        }

        if (!body.entityType || !body.entityId || !body.reason) {
          return Response.json({ message: 'entityType, entityId, and reason are required.' }, { status: 400 })
        }

        const db = getDb()
        await db.insert(communityFlags).values({
          id: crypto.randomUUID(),
          entityType: body.entityType,
          entityId: body.entityId,
          reason: body.reason,
          details: body.details ?? null,
          createdByUserId: authUser.id,
        })

        try {
          await sendAdminModerationAlert({
            kind: body.reason === 'comment_report' ? 'report' : 'flag',
            actor: {
              id: authUser.id,
              displayName: authUser.displayName,
              email: authUser.email,
            },
            entity: {
              type: body.entityType,
              id: body.entityId,
            },
            reason: body.reason,
            details: body.details ?? null,
          })
        } catch (error) {
          console.error('Failed sending moderation flag alert email', error)
        }

        return Response.json({ message: 'Flag submitted. Thank you for the report.' }, { status: 201 })
      },
    },
  },
})
