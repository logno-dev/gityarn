import { and, desc, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { assetFiles, comments, creations, patterns, posts, users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/profiles/$userId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const user = await db.query.users.findFirst({ where: eq(users.id, params.userId) })
        if (!user) {
          return Response.json({ message: 'Profile not found.' }, { status: 404 })
        }

        const avatar = await db.query.assetFiles.findFirst({
          where: and(eq(assetFiles.userId, user.id), eq(assetFiles.kind, 'profile-avatar')),
          orderBy: (table, { desc }) => [desc(table.updatedAt)],
        })

        const [postCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(posts)
          .where(and(eq(posts.userId, user.id), eq(posts.isPublic, true), eq(posts.moderationStatus, 'active')))

        const [patternCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(patterns)
          .where(and(eq(patterns.userId, user.id), eq(patterns.isPublic, true), eq(patterns.moderationStatus, 'active')))

        const [creationCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(creations)
          .where(and(eq(creations.userId, user.id), eq(creations.isPublic, true), eq(creations.moderationStatus, 'active')))

        const [commentCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(comments)
          .where(eq(comments.userId, user.id))

        const publicPosts = await db
          .select({
            id: posts.id,
            title: posts.title,
            body: posts.body,
            updatedAt: posts.updatedAt,
          })
          .from(posts)
          .where(and(eq(posts.userId, user.id), eq(posts.isPublic, true), eq(posts.moderationStatus, 'active')))
          .orderBy(desc(posts.updatedAt))
          .limit(30)

        const publicPatterns = await db
          .select({
            id: patterns.id,
            title: patterns.title,
            description: patterns.description,
            difficulty: patterns.difficulty,
            hasPdf: sql<boolean>`case when ${patterns.pdfR2Key} is not null then 1 else 0 end`,
            updatedAt: patterns.updatedAt,
          })
          .from(patterns)
          .where(and(eq(patterns.userId, user.id), eq(patterns.isPublic, true), eq(patterns.moderationStatus, 'active')))
          .orderBy(desc(patterns.updatedAt))
          .limit(30)

        const publicCreations = await db
          .select({
            id: creations.id,
            name: creations.name,
            notes: creations.notes,
            status: creations.status,
            updatedAt: creations.updatedAt,
          })
          .from(creations)
          .where(and(eq(creations.userId, user.id), eq(creations.isPublic, true), eq(creations.moderationStatus, 'active')))
          .orderBy(desc(creations.updatedAt))
          .limit(30)

        const recentComments = await db
          .select({
            id: comments.id,
            entityType: comments.entityType,
            entityId: comments.entityId,
            body: comments.body,
            createdAt: comments.createdAt,
          })
          .from(comments)
          .where(eq(comments.userId, user.id))
          .orderBy(desc(comments.createdAt))
          .limit(30)

        return Response.json(
          {
            profile: {
              id: user.id,
              displayName: user.displayName,
              bio: user.bio,
              avatarUpdatedAt: avatar?.updatedAt ?? null,
              websiteUrl: user.websiteUrl,
              instagramUrl: user.instagramUrl,
              etsyUrl: user.etsyUrl,
              ravelryUrl: user.ravelryUrl,
              tiktokUrl: user.tiktokUrl,
              youtubeUrl: user.youtubeUrl,
              joinedAt: user.createdAt,
            },
            stats: {
              posts: Number(postCountRow?.count) || 0,
              patterns: Number(patternCountRow?.count) || 0,
              creations: Number(creationCountRow?.count) || 0,
              comments: Number(commentCountRow?.count) || 0,
            },
            posts: publicPosts,
            patterns: publicPatterns,
            creations: publicCreations,
            comments: recentComments.map((item) => ({
              ...item,
              targetPath:
                item.entityType === 'post'
                  ? `/post/${item.entityId}`
                  : item.entityType === 'yarn_line'
                    ? `/catalog/${item.entityId}`
                    : null,
            })),
          },
          { status: 200 },
        )
      },
    },
  },
})
