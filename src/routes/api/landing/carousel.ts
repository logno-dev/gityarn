import { asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getDb } from '#/lib/db/client'
import { carouselItems } from '#/lib/db/schema'

export const Route = createFileRoute('/api/landing/carousel')({
  server: {
    handlers: {
      GET: async () => {
        const rows = await getDb()
          .select({
            id: carouselItems.id,
            altText: carouselItems.altText,
            linkUrl: carouselItems.linkUrl,
            sortOrder: carouselItems.sortOrder,
            updatedAt: carouselItems.updatedAt,
          })
          .from(carouselItems)
          .where(eq(carouselItems.isActive, true))
          .orderBy(asc(carouselItems.sortOrder), asc(carouselItems.createdAt))

        return Response.json(
          {
            items: rows.map((row) => ({
              ...row,
              imageSrc: `/api/landing/carousel/${row.id}/image`,
            })),
          },
          { status: 200 },
        )
      },
    },
  },
})
