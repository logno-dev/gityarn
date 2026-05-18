import { asc, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { manufacturers } from '#/lib/db/schema'

export const Route = createFileRoute('/api/catalog/manufacturers')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const query = url.searchParams.get('query')?.trim().toLowerCase() ?? ''
        const limitRaw = Number(url.searchParams.get('limit') ?? 8)
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 25) : 8

        const rows = await getDb()
          .select({
            id: manufacturers.id,
            name: manufacturers.name,
            yarnLineCount: sql<number>`(
              select count(*)
              from yarn_lines
              where yarn_lines.manufacturer_id = ${manufacturers.id}
            )`,
          })
          .from(manufacturers)
          .where(query ? sql`lower(${manufacturers.name}) like ${`%${query}%`}` : undefined)
          .orderBy(asc(manufacturers.name))
          .limit(limit)

        return Response.json({ manufacturers: rows }, { status: 200 })
      },
    },
  },
})
