import { eq, inArray } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { barcodes, manufacturers, yarnColorways, yarnLines } from '#/lib/db/schema'

export const Route = createFileRoute('/api/scan/resolve')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const rawBarcode = url.searchParams.get('barcode') ?? ''
        const candidates = resolveBarcodeCandidates(rawBarcode)
        if (!candidates.length) {
          return Response.json(
            {
              barcode: {
                id: null,
                barcodeValue: rawBarcode.trim(),
                format: 'unknown',
              },
              association: null,
              isAssociated: false,
              isKnownBarcode: false,
            },
            { status: 200 },
          )
        }

        const db = getDb()
        const barcode = await db.query.barcodes.findFirst({
          where: inArray(barcodes.barcodeValue, candidates),
        })

        if (!barcode) {
          return Response.json(
            {
              barcode: {
                id: null,
                barcodeValue: candidates[0],
                format: 'unknown',
              },
              association: null,
              isAssociated: false,
              isKnownBarcode: false,
            },
            { status: 200 },
          )
        }

        let association: {
          lineId: string | null
          lineName: string | null
          manufacturerName: string | null
          colorwayId: string | null
          colorwayName: string | null
        } | null = null

        if (barcode.yarnLineId) {
          const lineRow = await db
            .select({
              lineId: yarnLines.id,
              lineName: yarnLines.name,
              manufacturerName: manufacturers.name,
            })
            .from(yarnLines)
            .innerJoin(manufacturers, eq(yarnLines.manufacturerId, manufacturers.id))
            .where(eq(yarnLines.id, barcode.yarnLineId))
            .limit(1)

          const colorwayRow = barcode.yarnColorwayId
            ? await db.query.yarnColorways.findFirst({ where: eq(yarnColorways.id, barcode.yarnColorwayId) })
            : null

          association = {
            lineId: lineRow[0]?.lineId ?? null,
            lineName: lineRow[0]?.lineName ?? null,
            manufacturerName: lineRow[0]?.manufacturerName ?? null,
            colorwayId: colorwayRow?.id ?? null,
            colorwayName: colorwayRow?.name ?? null,
          }
        }

        return Response.json(
          {
            barcode: {
              id: barcode.id,
              barcodeValue: barcode.barcodeValue,
              format: barcode.format,
            },
            association,
            isAssociated: Boolean(association?.lineId),
            isKnownBarcode: true,
          },
          { status: 200 },
        )
      },
    },
  },
})

function resolveBarcodeCandidates(raw: string) {
  const compact = raw.trim().replace(/\s+/g, '')
  if (!compact) {
    return []
  }

  const candidates = new Set<string>()
  candidates.add(compact)

  const digits = compact.replace(/\D/g, '')
  if (digits.length >= 1) {
    candidates.add(digits)
  }

  const alphanumeric = compact.replace(/[^a-zA-Z0-9_-]/g, '')
  if (alphanumeric.length >= 1) {
    candidates.add(alphanumeric.toUpperCase())
  }

  return [...candidates]
}
