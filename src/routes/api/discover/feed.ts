import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { comments, creationImages, creations, patterns, postHearts, postImages, posts, users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/discover/feed')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const url = new URL(request.url)
        const pageRaw = Number(url.searchParams.get('page') ?? 1)
        const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1
        const pageSizeRaw = Number(url.searchParams.get('pageSize') ?? 20)
        const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(Math.floor(pageSizeRaw), 10), 40) : 20

        const db = getDb()

        const publicPatterns = await db
          .select({
            id: patterns.id,
            title: patterns.title,
            description: patterns.description,
            updatedAt: patterns.updatedAt,
            ownerDisplayName: users.displayName,
            hasCover: patterns.coverR2Key,
          })
          .from(patterns)
          .innerJoin(users, eq(patterns.userId, users.id))
          .where(and(eq(patterns.isPublic, true), eq(patterns.moderationStatus, 'active')))
          .orderBy(desc(patterns.updatedAt))
          .limit(300)

        const publicCreations = await db
          .select({
            id: creations.id,
            name: creations.name,
            notes: creations.notes,
            updatedAt: creations.updatedAt,
            ownerDisplayName: users.displayName,
          })
          .from(creations)
          .innerJoin(users, eq(creations.userId, users.id))
          .where(and(eq(creations.isPublic, true), eq(creations.moderationStatus, 'active')))
          .orderBy(desc(creations.updatedAt))
          .limit(300)

        const creationIds = publicCreations.map((row) => row.id)
        const creationPreviewImages = creationIds.length
          ? await db
              .select({
                creationId: creationImages.creationId,
                imageId: creationImages.id,
              })
              .from(creationImages)
              .where(inArray(creationImages.creationId, creationIds))
              .orderBy(desc(creationImages.createdAt))
          : []

        const firstCreationImageMap = new Map<string, string>()
        for (const image of creationPreviewImages) {
          if (!firstCreationImageMap.has(image.creationId)) {
            firstCreationImageMap.set(image.creationId, image.imageId)
          }
        }

        const publicPosts = await db
          .select({
            id: posts.id,
            title: posts.title,
            body: posts.body,
            updatedAt: posts.updatedAt,
            ownerDisplayName: users.displayName,
          })
          .from(posts)
          .innerJoin(users, eq(posts.userId, users.id))
          .where(and(eq(posts.isPublic, true), eq(posts.moderationStatus, 'active')))
          .orderBy(desc(posts.updatedAt))
          .limit(500)

        const postIds = publicPosts.map((row) => row.id)
        const postPreviewImages = postIds.length
          ? await db
              .select({ postId: postImages.postId, imageId: postImages.id })
              .from(postImages)
              .where(inArray(postImages.postId, postIds))
              .orderBy(desc(postImages.createdAt))
          : []

        const firstPostImageMap = new Map<string, string>()
        for (const image of postPreviewImages) {
          if (!firstPostImageMap.has(image.postId)) {
            firstPostImageMap.set(image.postId, image.imageId)
          }
        }

        const postHeartCounts = postIds.length
          ? await db
              .select({ postId: postHearts.postId, count: sql<number>`count(*)` })
              .from(postHearts)
              .where(inArray(postHearts.postId, postIds))
              .groupBy(postHearts.postId)
          : []

        const viewerHeartRows = postIds.length
          ? await db
              .select({ postId: postHearts.postId })
              .from(postHearts)
              .where(and(inArray(postHearts.postId, postIds), eq(postHearts.userId, authUser.id)))
          : []

        const postCommentCounts = postIds.length
          ? await db
              .select({ entityId: comments.entityId, count: sql<number>`count(*)` })
              .from(comments)
              .where(and(eq(comments.entityType, 'post'), inArray(comments.entityId, postIds)))
              .groupBy(comments.entityId)
          : []

        const heartCountMap = new Map(postHeartCounts.map((row) => [row.postId, Number(row.count) || 0]))
        const viewerHeartSet = new Set(viewerHeartRows.map((row) => row.postId))
        const commentCountMap = new Map(postCommentCounts.map((row) => [row.entityId, Number(row.count) || 0]))

        const merged = [
          ...publicPatterns.map((item) => ({
            id: `pattern:${item.id}`,
            kind: 'pattern' as const,
            entityId: item.id,
            title: item.title,
            body: item.description,
            ownerDisplayName: item.ownerDisplayName,
            previewImage: item.hasCover ? `/api/patterns/${item.id}/cover` : null,
            downloadUrl: `/api/patterns/${item.id}/file`,
            createdAt: item.updatedAt,
          })),
          ...publicCreations.map((item) => ({
            id: `creation:${item.id}`,
            kind: 'creation' as const,
            entityId: item.id,
            title: item.name,
            body: item.notes,
            ownerDisplayName: item.ownerDisplayName,
            previewImage: firstCreationImageMap.get(item.id)
              ? `/api/creations/${item.id}/images?imageId=${firstCreationImageMap.get(item.id)}`
              : null,
            downloadUrl: null,
            createdAt: item.updatedAt,
          })),
          ...publicPosts.map((item) => ({
            id: `post:${item.id}`,
            kind: 'post' as const,
            entityId: item.id,
            title: item.title,
            body: item.body,
            ownerDisplayName: item.ownerDisplayName,
            previewImage: firstPostImageMap.get(item.id)
              ? `/api/posts/${item.id}/images?imageId=${firstPostImageMap.get(item.id)}`
              : null,
            downloadUrl: null,
            heartCount: heartCountMap.get(item.id) ?? 0,
            viewerHasHeart: viewerHeartSet.has(item.id),
            commentCount: commentCountMap.get(item.id) ?? 0,
            createdAt: item.updatedAt,
          })),
        ].sort((a, b) => b.createdAt - a.createdAt)

        const offset = (page - 1) * pageSize
        const slice = merged.slice(offset, offset + pageSize)

        return Response.json(
          {
            items: slice,
            pagination: {
              page,
              pageSize,
              totalItems: merged.length,
              hasNextPage: offset + pageSize < merged.length,
            },
          },
          { status: 200 },
        )
      },
    },
  },
})
