import { and, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { createNotification } from '#/lib/notifications/create'
import { postHearts, posts } from '#/lib/db/schema'

export const Route = createFileRoute('/api/posts/$postId/hearts')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const post = await getDb().query.posts.findFirst({ where: eq(posts.id, params.postId) })
        if (!post) return Response.json({ message: 'Post not found.' }, { status: 404 })
        if (!post.isPublic && post.userId !== authUser.id) return Response.json({ message: 'Forbidden' }, { status: 403 })

        const [countRow] = await getDb()
          .select({ count: sql<number>`count(*)` })
          .from(postHearts)
          .where(eq(postHearts.postId, params.postId))

        const existing = await getDb().query.postHearts.findFirst({
          where: and(eq(postHearts.postId, params.postId), eq(postHearts.userId, authUser.id)),
        })

        return Response.json(
          {
            postId: params.postId,
            heartCount: Number(countRow?.count) || 0,
            viewerHasHeart: Boolean(existing),
          },
          { status: 200 },
        )
      },
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const post = await getDb().query.posts.findFirst({ where: eq(posts.id, params.postId) })
        if (!post) return Response.json({ message: 'Post not found.' }, { status: 404 })
        if (!post.isPublic && post.userId !== authUser.id) return Response.json({ message: 'Forbidden' }, { status: 403 })

        const db = getDb()
        const existing = await db.query.postHearts.findFirst({
          where: and(eq(postHearts.postId, params.postId), eq(postHearts.userId, authUser.id)),
        })

        if (existing) {
          await db
            .delete(postHearts)
            .where(and(eq(postHearts.postId, params.postId), eq(postHearts.userId, authUser.id)))
        } else {
          await db.insert(postHearts).values({
            postId: params.postId,
            userId: authUser.id,
            createdAt: Date.now(),
          })
          if (post.userId !== authUser.id) {
            await createNotification({
              userId: post.userId,
              actorUserId: authUser.id,
              type: 'post_hearted',
              entityType: 'post',
              entityId: post.id,
              message: `${authUser.displayName} hearted your post.`,
              targetPath: `/post/${post.id}`,
              dedupeWindowMs: 1000 * 60 * 10,
            })
          }
        }

        const [countRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(postHearts)
          .where(eq(postHearts.postId, params.postId))

        return Response.json(
          {
            postId: params.postId,
            heartCount: Number(countRow?.count) || 0,
            viewerHasHeart: !existing,
          },
          { status: 200 },
        )
      },
    },
  },
})
