import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { comments, creations, patterns, posts } from '#/lib/db/schema'

export const Route = createFileRoute('/api/admin/moderation/remove')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }
        if (authUser.role !== 'admin') {
          return Response.json({ message: 'Forbidden' }, { status: 403 })
        }

        const body = (await request.json()) as {
          entityType?: 'pattern' | 'creation' | 'post' | 'comment'
          entityId?: string
          reason?: string | null
        }

        const entityId = body.entityId?.trim() ?? ''
        if (!body.entityType || !entityId) {
          return Response.json({ message: 'entityType and entityId are required.' }, { status: 400 })
        }

        const now = Date.now()
        const moderationReason = body.reason?.trim() || null
        const db = getDb()

        if (body.entityType === 'pattern') {
          const existing = await db.query.patterns.findFirst({ where: eq(patterns.id, entityId) })
          if (!existing) {
            return Response.json({ message: 'Pattern not found.' }, { status: 404 })
          }
          await db
            .update(patterns)
            .set({
              isPublic: false,
              moderationStatus: 'removed',
              moderationReason,
              moderatedByUserId: authUser.id,
              moderatedAt: now,
              updatedAt: now,
            })
            .where(and(eq(patterns.id, entityId)))
          return Response.json({ message: 'Pattern removed from public visibility.' }, { status: 200 })
        }

        if (body.entityType === 'creation') {
          const existing = await db.query.creations.findFirst({ where: eq(creations.id, entityId) })
          if (!existing) {
            return Response.json({ message: 'Creation not found.' }, { status: 404 })
          }
          await db
            .update(creations)
            .set({
              isPublic: false,
              moderationStatus: 'removed',
              moderationReason,
              moderatedByUserId: authUser.id,
              moderatedAt: now,
              updatedAt: now,
            })
            .where(and(eq(creations.id, entityId)))
          return Response.json({ message: 'Creation removed from public visibility.' }, { status: 200 })
        }

        if (body.entityType === 'post') {
          const existing = await db.query.posts.findFirst({ where: eq(posts.id, entityId) })
          if (!existing) {
            return Response.json({ message: 'Post not found.' }, { status: 404 })
          }
          await db
            .update(posts)
            .set({
              isPublic: false,
              moderationStatus: 'removed',
              moderationReason,
              moderatedByUserId: authUser.id,
              moderatedAt: now,
              updatedAt: now,
            })
            .where(and(eq(posts.id, entityId)))
          return Response.json({ message: 'Post removed from public visibility.' }, { status: 200 })
        }

        if (body.entityType === 'comment') {
          const existing = await db.query.comments.findFirst({ where: eq(comments.id, entityId) })
          if (!existing) {
            return Response.json({ message: 'Comment not found.' }, { status: 404 })
          }
          await db
            .update(comments)
            .set({
              moderationStatus: 'removed',
              moderationReason,
              moderatedByUserId: authUser.id,
              moderatedAt: now,
              updatedAt: now,
            })
            .where(and(eq(comments.id, entityId)))
          return Response.json({ message: 'Comment removed.' }, { status: 200 })
        }

        return Response.json({ message: 'Unsupported entityType.' }, { status: 400 })
      },
    },
  },
})
