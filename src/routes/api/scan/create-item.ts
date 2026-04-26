import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { barcodes, manufacturers, yarnColorways, yarnLines } from '#/lib/db/schema'

export const Route = createFileRoute('/api/scan/create-item')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as {
          barcodeValue?: string
          manufacturerName?: string
          lineName?: string
          colorwayName?: string
          colorCode?: string
          weightClass?: string
          fiberContent?: string
          yardageMeters?: number | null
          productUrl?: string
        }

        const barcodeValue = normalizeBarcode(body.barcodeValue ?? '')
        const manufacturerName = body.manufacturerName?.trim()
        const lineName = body.lineName?.trim()

        if (!barcodeValue || !manufacturerName || !lineName) {
          return Response.json({ message: 'barcodeValue, manufacturerName, and lineName are required.' }, { status: 400 })
        }

        const db = getDb()

        const manufacturerSlugBase = slugify(manufacturerName)
        let manufacturer = await db.query.manufacturers.findFirst({ where: eq(manufacturers.slug, manufacturerSlugBase) })

        if (!manufacturer) {
          const slug = await uniqueManufacturerSlug(manufacturerSlugBase)
          const id = crypto.randomUUID()
          await db.insert(manufacturers).values({ id, name: manufacturerName, slug })
          manufacturer = { id, name: manufacturerName, slug } as typeof manufacturers.$inferSelect
        }

        const lineSlugBase = slugify(`${manufacturer.name}-${lineName}`)
        let line = await db.query.yarnLines.findFirst({ where: eq(yarnLines.slug, lineSlugBase) })
        if (!line) {
          const slug = await uniqueLineSlug(lineSlugBase)
          const id = crypto.randomUUID()
          const yardageMeters = Number.isFinite(body.yardageMeters) ? Math.round(Number(body.yardageMeters)) : null

          await db.insert(yarnLines).values({
            id,
            manufacturerId: manufacturer.id,
            name: lineName,
            slug,
            weightClass: body.weightClass?.trim() || null,
            fiberContent: body.fiberContent?.trim() || null,
            yardageMeters,
            productUrl: body.productUrl?.trim() || null,
          })

          line = {
            id,
            manufacturerId: manufacturer.id,
            name: lineName,
            slug,
          } as typeof yarnLines.$inferSelect
        }

        let colorwayId: string | null = null
        const colorwayName = body.colorwayName?.trim()
        if (colorwayName) {
          let colorway = await db.query.yarnColorways.findFirst({
            where: and(eq(yarnColorways.yarnLineId, line.id), eq(yarnColorways.name, colorwayName)),
          })

          if (!colorway) {
            const id = crypto.randomUUID()
            await db.insert(yarnColorways).values({
              id,
              yarnLineId: line.id,
              name: colorwayName,
              colorCode: body.colorCode?.trim() || null,
            })
            colorway = { id } as typeof yarnColorways.$inferSelect
          }

          colorwayId = colorway.id
        }

        const existingBarcode = await db.query.barcodes.findFirst({ where: eq(barcodes.barcodeValue, barcodeValue) })
        if (existingBarcode) {
          await db
            .update(barcodes)
            .set({
              yarnLineId: line.id,
              yarnColorwayId: colorwayId,
              format: inferBarcodeFormat(barcodeValue),
              updatedAt: Date.now(),
            })
            .where(eq(barcodes.id, existingBarcode.id))
        } else {
          await db.insert(barcodes).values({
            id: crypto.randomUUID(),
            barcodeValue,
            format: inferBarcodeFormat(barcodeValue),
            yarnLineId: line.id,
            yarnColorwayId: colorwayId,
          })
        }

        return Response.json(
          {
            message: 'Catalog item created and barcode associated.',
            lineId: line.id,
            colorwayId,
          },
          { status: 201 },
        )
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function uniqueManufacturerSlug(base: string) {
  const db = getDb()
  let candidate = base
  let index = 2
  while (await db.query.manufacturers.findFirst({ where: eq(manufacturers.slug, candidate) })) {
    candidate = `${base}-${index}`
    index += 1
  }
  return candidate
}

async function uniqueLineSlug(base: string) {
  const db = getDb()
  let candidate = base
  let index = 2
  while (await db.query.yarnLines.findFirst({ where: eq(yarnLines.slug, candidate) })) {
    candidate = `${base}-${index}`
    index += 1
  }
  return candidate
}
