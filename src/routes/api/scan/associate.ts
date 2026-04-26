import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { barcodes, yarnColorways, yarnLines } from '#/lib/db/schema'

export const Route = createFileRoute('/api/scan/associate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as {
          barcodeValue?: string
          lineId?: string
          colorwayId?: string | null
          newColorwayName?: string | null
          newColorCode?: string | null
        }

        const barcodeValue = normalizeBarcode(body.barcodeValue ?? '')
        if (!barcodeValue || !body.lineId) {
          return Response.json({ message: 'barcodeValue and lineId are required.' }, { status: 400 })
        }

        const db = getDb()
        const line = await db.query.yarnLines.findFirst({ where: eq(yarnLines.id, body.lineId) })
        if (!line) {
          return Response.json({ message: 'Yarn line not found.' }, { status: 404 })
        }

        let colorwayId: string | null = null
        const newColorwayName = body.newColorwayName?.trim()

        if (newColorwayName) {
          const existingByName = await db.query.yarnColorways.findFirst({
            where: and(eq(yarnColorways.yarnLineId, line.id), eq(yarnColorways.name, newColorwayName)),
          })

          if (existingByName) {
            colorwayId = existingByName.id
          } else {
            const createdColorwayId = crypto.randomUUID()
            await db.insert(yarnColorways).values({
              id: createdColorwayId,
              yarnLineId: line.id,
              name: newColorwayName,
              colorCode: body.newColorCode?.trim() || null,
            })
            colorwayId = createdColorwayId
          }
        } else if (body.colorwayId) {
          const colorway = await db.query.yarnColorways.findFirst({
            where: and(eq(yarnColorways.id, body.colorwayId), eq(yarnColorways.yarnLineId, line.id)),
          })
          if (!colorway) {
            return Response.json({ message: 'Colorway not found for selected line.' }, { status: 400 })
          }
          colorwayId = colorway.id
        }

        const existing = await db.query.barcodes.findFirst({ where: eq(barcodes.barcodeValue, barcodeValue) })
        if (existing) {
          await db
            .update(barcodes)
            .set({
              yarnLineId: line.id,
              yarnColorwayId: colorwayId,
              format: inferBarcodeFormat(barcodeValue),
              updatedAt: Date.now(),
            })
            .where(eq(barcodes.id, existing.id))
        } else {
          await db.insert(barcodes).values({
            id: crypto.randomUUID(),
            barcodeValue,
            format: inferBarcodeFormat(barcodeValue),
            yarnLineId: line.id,
            yarnColorwayId: colorwayId,
          })
        }

        return Response.json({ message: 'Barcode associated successfully.' }, { status: 200 })
      },
    },
  },
})

function normalizeBarcode(raw: string) {
  const compact = raw.trim().replace(/\s+/g, '')
  if (!compact) {
    return null
  }

  const digits = compact.replace(/\D/g, '')
  if (digits.length >= 8) {
    return digits
  }

  const alphanumeric = compact.replace(/[^a-zA-Z0-9_-]/g, '')
  if (alphanumeric.length >= 1) {
    return alphanumeric.toUpperCase()
  }

  return compact
}

function inferBarcodeFormat(value: string) {
  if (!/^\d+$/.test(value)) {
    return 'unknown'
  }
  if (value.length === 8) {
    return 'ean_8'
  }
  if (value.length === 12) {
    return 'upc_a'
  }
  if (value.length === 13) {
    return 'ean_13'
  }
  return 'unknown'
}
