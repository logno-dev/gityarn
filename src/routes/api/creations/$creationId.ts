import { and, asc, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import {
  comments,
  creationHearts,
  creationHooks,
  creationImages,
  creationYarn,
  creations,
  hooks,
  inventoryYarn,
  manufacturers,
  patterns,
  users,
  yarnColorways,
  yarnLines,
} from '#/lib/db/schema'

export const Route = createFileRoute('/api/creations/$creationId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const db = getDb()
        const creation = await db
          .select({
            id: creations.id,
            userId: creations.userId,
            ownerDisplayName: users.displayName,
            name: creations.name,
            status: creations.status,
            notes: creations.notes,
            isPublic: creations.isPublic,
            moderationStatus: creations.moderationStatus,
            moderationReason: creations.moderationReason,
            patternId: creations.patternId,
            updatedAt: creations.updatedAt,
            patternTitle: patterns.title,
            patternIsPublic: patterns.isPublic,
            patternHasPdf: sql<boolean>`case when ${patterns.pdfR2Key} is not null then 1 else 0 end`,
          })
          .from(creations)
          .innerJoin(users, eq(creations.userId, users.id))
          .leftJoin(patterns, eq(creations.patternId, patterns.id))
          .where(eq(creations.id, params.creationId))
          .limit(1)
          .then((rows) => rows[0] ?? null)

        if (!creation) return Response.json({ message: 'Creation not found.' }, { status: 404 })
        if (!creation.isPublic && creation.userId !== authUser.id) return Response.json({ message: 'Forbidden' }, { status: 403 })

        const images = await db
          .select({ id: creationImages.id, createdAt: creationImages.createdAt })
          .from(creationImages)
          .where(eq(creationImages.creationId, creation.id))
          .orderBy(asc(creationImages.createdAt))

        const [heartRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(creationHearts)
          .where(eq(creationHearts.creationId, creation.id))

        const viewerHeart = await db.query.creationHearts.findFirst({
          where: and(eq(creationHearts.creationId, creation.id), eq(creationHearts.userId, authUser.id)),
        })

        const [commentRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(comments)
          .where(and(eq(comments.entityType, 'creation'), eq(comments.entityId, creation.id)))

        const yarnRows = await db
          .select({
            inventoryId: creationYarn.inventoryYarnId,
            lineId: inventoryYarn.yarnLineId,
            lineName: yarnLines.name,
            manufacturerName: manufacturers.name,
            colorwayName: yarnColorways.name,
            colorCode: yarnColorways.colorCode,
            skeinsUsed: creationYarn.skeinsUsed,
          })
          .from(creationYarn)
          .innerJoin(inventoryYarn, eq(creationYarn.inventoryYarnId, inventoryYarn.id))
          .leftJoin(yarnLines, eq(inventoryYarn.yarnLineId, yarnLines.id))
          .leftJoin(manufacturers, eq(yarnLines.manufacturerId, manufacturers.id))
          .leftJoin(yarnColorways, eq(inventoryYarn.yarnColorwayId, yarnColorways.id))
          .where(eq(creationYarn.creationId, creation.id))

        const hookRows = await db
          .select({
            hookId: creationHooks.hookId,
            sizeLabel: hooks.sizeLabel,
            metricSizeMm: hooks.metricSizeMm,
            material: hooks.material,
          })
          .from(creationHooks)
          .innerJoin(hooks, eq(creationHooks.hookId, hooks.id))
          .where(eq(creationHooks.creationId, creation.id))

        return Response.json(
          {
            ...creation,
            images: images.map((img) => ({
              id: img.id,
              src: `/api/creations/${creation.id}/images?imageId=${img.id}`,
            })),
            heartCount: Number(heartRow?.count) || 0,
            viewerHasHeart: Boolean(viewerHeart),
            commentCount: Number(commentRow?.count) || 0,
            yarn: yarnRows,
            hooks: hookRows,
            pattern:
              creation.patternId && creation.patternTitle
                ? {
                    id: creation.patternId,
                    title: creation.patternTitle,
                    isPublic: Boolean(creation.patternIsPublic),
                    hasPdf: Boolean(creation.patternHasPdf),
                  }
                : null,
          },
          { status: 200 },
        )
      },
    },
  },
})
