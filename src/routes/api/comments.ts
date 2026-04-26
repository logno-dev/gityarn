import { and, asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { comments, users } from '#/lib/db/schema'

const MAX_DEPTH = 6

export const Route = createFileRoute('/api/comments')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const entityType = (url.searchParams.get('entityType') ?? '').trim()
        const entityId = (url.searchParams.get('entityId') ?? '').trim()

        if (!entityType || !entityId) {
          return Response.json({ message: 'entityType and entityId are required.' }, { status: 400 })
        }

        const rows = await getDb()
          .select({
            id: comments.id,
            entityType: comments.entityType,
            entityId: comments.entityId,
            parentCommentId: comments.parentCommentId,
            body: comments.body,
            depth: comments.depth,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt,
            authorId: users.id,
            authorDisplayName: users.displayName,
          })
          .from(comments)
          .innerJoin(users, eq(comments.userId, users.id))
          .where(and(eq(comments.entityType, entityType), eq(comments.entityId, entityId)))
          .orderBy(asc(comments.createdAt))

        return Response.json(
          {
            comments: rows.map((row) => ({
              id: row.id,
              entityType: row.entityType,
              entityId: row.entityId,
              parentCommentId: row.parentCommentId,
              body: row.body,
              depth: row.depth,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              author: {
                id: row.authorId,
                displayName: row.authorDisplayName,
              },
            })),
          },
          { status: 200 },
        )
      },
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as {
          entityType?: string
          entityId?: string
          parentCommentId?: string | null
          text?: string
        }

        const entityType = body.entityType?.trim() ?? ''
        const entityId = body.entityId?.trim() ?? ''
        const text = body.text?.trim() ?? ''

        if (!entityType || !entityId) {
          return Response.json({ message: 'entityType and entityId are required.' }, { status: 400 })
        }
        if (!text) {
          return Response.json({ message: 'Comment text is required.' }, { status: 400 })
        }
        if (text.length > 2000) {
          return Response.json({ message: 'Comment text must be 2000 characters or less.' }, { status: 400 })
        }

        let depth = 0
        const parentCommentId = body.parentCommentId?.trim() || null
        if (parentCommentId) {
          const parent = await getDb().query.comments.findFirst({ where: eq(comments.id, parentCommentId) })
          if (!parent) {
            return Response.json({ message: 'Parent comment not found.' }, { status: 404 })
          }
          if (parent.entityType !== entityType || parent.entityId !== entityId) {
            return Response.json({ message: 'Parent comment belongs to a different entity.' }, { status: 400 })
          }
          depth = parent.depth + 1
          if (depth > MAX_DEPTH) {
            return Response.json({ message: `Reply depth is limited to ${MAX_DEPTH}.` }, { status: 400 })
          }
        }

        const now = Date.now()
        await getDb().insert(comments).values({
          id: crypto.randomUUID(),
          userId: authUser.id,
          entityType,
          entityId,
          parentCommentId,
          body: text,
          depth,
          createdAt: now,
          updatedAt: now,
        })

        return Response.json({ message: 'Comment posted.' }, { status: 201 })
      },
    },
  },
})
