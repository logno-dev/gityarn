import { eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { barcodes, yarnLines } from '#/lib/db/schema'

export const Route = createFileRoute('/api/catalog/$lineId/barcodes')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const line = await db.query.yarnLines.findFirst({ where: eq(yarnLines.id, params.lineId) })
        if (!line) {
          return Response.json({ message: 'Catalog line not found.' }, { status: 404 })
        }

        const body = (await request.json()) as { barcodeValue?: string }
        const barcodeValue = normalizeBarcode(body.barcodeValue ?? '')

        if (!barcodeValue) {
          return Response.json({ message: 'Valid barcode is required (8+ digits).' }, { status: 400 })
        }

        const existing = await db.query.barcodes.findFirst({ where: eq(barcodes.barcodeValue, barcodeValue) })
        if (existing) {
          await db
            .update(barcodes)
            .set({
              yarnLineId: params.lineId,
              format: inferBarcodeFormat(barcodeValue),
              updatedAt: Date.now(),
            })
            .where(eq(barcodes.id, existing.id))
        } else {
          await db.insert(barcodes).values({
            id: crypto.randomUUID(),
            barcodeValue,
            format: inferBarcodeFormat(barcodeValue),
            yarnLineId: params.lineId,
          })
        }

        return Response.json({ message: 'Barcode associated to yarn line.' }, { status: 200 })
      },
    },
  },
})

function normalizeBarcode(raw: string) {
  const onlyDigits = raw.replace(/\D/g, '')
  return onlyDigits.length >= 8 ? onlyDigits : null
}

function inferBarcodeFormat(value: string) {
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
