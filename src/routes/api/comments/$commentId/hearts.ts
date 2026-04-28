import { and, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { commentHearts, comments } from '#/lib/db/schema'

export const Route = createFileRoute('/api/comments/$commentId/hearts')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const comment = await db.query.comments.findFirst({ where: eq(comments.id, params.commentId) })
        if (!comment) {
          return Response.json({ message: 'Comment not found.' }, { status: 404 })
        }
        if (comment.moderationStatus === 'removed') {
          return Response.json({ message: 'Removed comments cannot receive hearts.' }, { status: 400 })
        }

        const existing = await db.query.commentHearts.findFirst({
          where: and(eq(commentHearts.commentId, params.commentId), eq(commentHearts.userId, authUser.id)),
        })

        if (existing) {
          await db
            .delete(commentHearts)
            .where(and(eq(commentHearts.commentId, params.commentId), eq(commentHearts.userId, authUser.id)))

          const [countRow] = await db
            .select({ count: sql<number>`count(*)` })
            .from(commentHearts)
            .where(eq(commentHearts.commentId, params.commentId))

          return Response.json(
            {
              message: 'Comment heart removed.',
              viewerHasHeart: false,
              heartCount: Number(countRow?.count) || 0,
            },
            { status: 200 },
          )
        }

        await db.insert(commentHearts).values({
          commentId: params.commentId,
          userId: authUser.id,
          createdAt: Date.now(),
        })

        const [countRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(commentHearts)
          .where(eq(commentHearts.commentId, params.commentId))

        return Response.json(
          {
            message: 'Comment heart added.',
            viewerHasHeart: true,
            heartCount: Number(countRow?.count) || 0,
          },
          { status: 201 },
        )
      },
    },
  },
})
