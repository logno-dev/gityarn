import { and, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { comments, postHearts, postImages, posts, users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/posts/$postId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const post = await db
          .select({
            id: posts.id,
            title: posts.title,
            body: posts.body,
            ownerId: users.id,
            ownerDisplayName: users.displayName,
            isPublic: posts.isPublic,
            moderationStatus: posts.moderationStatus,
            moderationReason: posts.moderationReason,
            updatedAt: posts.updatedAt,
          })
          .from(posts)
          .innerJoin(users, eq(posts.userId, users.id))
          .where(eq(posts.id, params.postId))
          .limit(1)

        const item = post[0]
        if (!item) {
          return Response.json({ message: 'Post not found.' }, { status: 404 })
        }

        const isOwner = item.ownerId === authUser.id
        const isPublicVisible = item.isPublic && item.moderationStatus === 'active'
        if (!isOwner && !isPublicVisible) {
          return Response.json({ message: 'Post is unavailable.' }, { status: 404 })
        }

        const images = await db
          .select({ id: postImages.id, mimeType: postImages.mimeType, createdAt: postImages.createdAt })
          .from(postImages)
          .where(eq(postImages.postId, params.postId))

        const [heartCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(postHearts)
          .where(eq(postHearts.postId, params.postId))

        const viewerHeart = await db.query.postHearts.findFirst({
          where: and(eq(postHearts.postId, params.postId), eq(postHearts.userId, authUser.id)),
        })

        const [commentCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(comments)
          .where(and(eq(comments.entityType, 'post'), eq(comments.entityId, params.postId)))

        return Response.json(
          {
            post: {
              id: item.id,
              title: item.title,
              body: item.body,
              ownerDisplayName: item.ownerDisplayName,
              moderationStatus: item.moderationStatus,
              moderationReason: item.moderationReason,
              updatedAt: item.updatedAt,
              heartCount: Number(heartCountRow?.count) || 0,
              viewerHasHeart: Boolean(viewerHeart),
              commentCount: Number(commentCountRow?.count) || 0,
              images: images.map((image) => ({
                id: image.id,
                mimeType: image.mimeType,
                createdAt: image.createdAt,
                src: `/api/posts/${params.postId}/images?imageId=${image.id}`,
              })),
            },
          },
          { status: 200 },
        )
      },
    },
  },
})
