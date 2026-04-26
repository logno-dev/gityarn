import { and, desc, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { patterns, users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/public')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const query = (new URL(request.url).searchParams.get('query') ?? '').trim().toLowerCase()
        const whereClause = query
          ? and(
              eq(patterns.isPublic, true),
              sql`(
                lower(${patterns.title}) like ${`%${query}%`}
                or lower(coalesce(${patterns.description}, '')) like ${`%${query}%`}
                or lower(coalesce(${patterns.difficulty}, '')) like ${`%${query}%`}
                or lower(${users.displayName}) like ${`%${query}%`}
              )`,
            )
          : eq(patterns.isPublic, true)

        const rows = await getDb()
          .select({
            id: patterns.id,
            title: patterns.title,
            description: patterns.description,
            difficulty: patterns.difficulty,
            sourceUrl: patterns.sourceUrl,
            hasPdf: sql<boolean>`case when ${patterns.pdfR2Key} is not null then 1 else 0 end`,
            hasCover: sql<boolean>`case when ${patterns.coverR2Key} is not null then 1 else 0 end`,
            ownerDisplayName: users.displayName,
            updatedAt: patterns.updatedAt,
          })
          .from(patterns)
          .innerJoin(users, eq(patterns.userId, users.id))
          .where(whereClause)
          .orderBy(desc(patterns.updatedAt))
          .limit(200)

        return Response.json({ patterns: rows }, { status: 200 })
      },
    },
  },
})
