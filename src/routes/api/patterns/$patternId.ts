import { and, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { comments, patternHearts, patternLibraryLinks, patterns, users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const db = getDb()
        const pattern = await db
          .select({
            id: patterns.id,
            userId: patterns.userId,
            ownerDisplayName: users.displayName,
            title: patterns.title,
            description: patterns.description,
            sourceUrl: patterns.sourceUrl,
            difficulty: patterns.difficulty,
            notes: patterns.notes,
            isPublic: patterns.isPublic,
            hasPdf: sql<boolean>`case when ${patterns.pdfR2Key} is not null then 1 else 0 end`,
            hasCover: sql<boolean>`case when ${patterns.coverR2Key} is not null then 1 else 0 end`,
            hasPreview: sql<boolean>`case when ${patterns.pdfPreviewR2Key} is not null then 1 else 0 end`,
            updatedAt: patterns.updatedAt,
          })
          .from(patterns)
          .innerJoin(users, eq(patterns.userId, users.id))
          .where(eq(patterns.id, params.patternId))
          .limit(1)
          .then((rows) => rows[0] ?? null)

        if (!pattern) return Response.json({ message: 'Pattern not found.' }, { status: 404 })
        if (!pattern.isPublic && pattern.userId !== authUser.id) return Response.json({ message: 'Forbidden' }, { status: 403 })

        const [heartRow] = await db.select({ count: sql<number>`count(*)` }).from(patternHearts).where(eq(patternHearts.patternId, pattern.id))
        const viewerHeart = await db.query.patternHearts.findFirst({ where: and(eq(patternHearts.patternId, pattern.id), eq(patternHearts.userId, authUser.id)) })
        const [commentRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(comments)
          .where(and(eq(comments.entityType, 'pattern'), eq(comments.entityId, pattern.id)))
        const inLibrary = await db.query.patternLibraryLinks.findFirst({ where: and(eq(patternLibraryLinks.patternId, pattern.id), eq(patternLibraryLinks.userId, authUser.id)) })

        return Response.json({
          ...pattern,
          coverSrc: pattern.hasCover ? `/api/patterns/${pattern.id}/cover` : pattern.hasPreview ? `/api/patterns/${pattern.id}/preview` : null,
          heartCount: Number(heartRow?.count) || 0,
          viewerHasHeart: Boolean(viewerHeart),
          commentCount: Number(commentRow?.count) || 0,
          inLibrary: pattern.userId === authUser.id || Boolean(inLibrary),
        })
      },
    },
  },
})
