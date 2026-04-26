import { asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { barcodes, manufacturers, yarnColorways, yarnLines } from '#/lib/db/schema'

export const Route = createFileRoute('/api/catalog/$lineId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const line = await db
          .select({
            id: yarnLines.id,
            name: yarnLines.name,
            manufacturerName: manufacturers.name,
            weightClass: yarnLines.weightClass,
            fiberContent: yarnLines.fiberContent,
            yardageMeters: yarnLines.yardageMeters,
            needleOrHookRange: yarnLines.needleOrHookRange,
            productUrl: yarnLines.productUrl,
          })
          .from(yarnLines)
          .innerJoin(manufacturers, eq(yarnLines.manufacturerId, manufacturers.id))
          .where(eq(yarnLines.id, params.lineId))
          .limit(1)

        if (!line[0]) {
          return Response.json({ message: 'Catalog line not found.' }, { status: 404 })
        }

        const colors = await db
          .select({
            id: yarnColorways.id,
            name: yarnColorways.name,
            colorCode: yarnColorways.colorCode,
            hexReference: yarnColorways.hexReference,
          })
          .from(yarnColorways)
          .where(eq(yarnColorways.yarnLineId, params.lineId))
          .orderBy(asc(yarnColorways.name))

        const barcodeRows = await db
          .select({
            id: barcodes.id,
            barcodeValue: barcodes.barcodeValue,
            format: barcodes.format,
            colorwayId: barcodes.yarnColorwayId,
            colorwayName: yarnColorways.name,
            colorCode: yarnColorways.colorCode,
          })
          .from(barcodes)
          .leftJoin(yarnColorways, eq(barcodes.yarnColorwayId, yarnColorways.id))
          .where(eq(barcodes.yarnLineId, params.lineId))
          .orderBy(asc(barcodes.barcodeValue))

        return Response.json(
          {
            line: line[0],
            colorways: colors,
            barcodes: barcodeRows,
          },
          { status: 200 },
        )
      },
    },
  },
})
