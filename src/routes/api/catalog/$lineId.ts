import { and, asc, eq } from 'drizzle-orm'
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
            manufacturerId: manufacturers.id,
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
            canAdminEdit: authUser.role === 'admin',
            line: line[0],
            colorways: colors,
            barcodes: barcodeRows,
          },
          { status: 200 },
        )
      },
      PATCH: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        if (authUser.role !== 'admin') return Response.json({ message: 'Forbidden' }, { status: 403 })

        const db = getDb()
        const line = await db.query.yarnLines.findFirst({ where: eq(yarnLines.id, params.lineId) })
        if (!line) return Response.json({ message: 'Catalog line not found.' }, { status: 404 })

        const body = (await request.json()) as {
          entityType?: 'line' | 'colorway' | 'barcode'
          entityId?: string
          manufacturerName?: string
          name?: string
          weightClass?: string | null
          fiberContent?: string | null
          yardageMeters?: number | null
          needleOrHookRange?: string | null
          productUrl?: string | null
          colorCode?: string | null
          hexReference?: string | null
          barcodeValue?: string
          colorwayId?: string | null
        }

        if (body.entityType === 'line') {
          const manufacturerName = body.manufacturerName?.trim() ?? ''
          const lineName = body.name?.trim() ?? ''
          if (!manufacturerName || !lineName) {
            return Response.json({ message: 'Manufacturer and line name are required.' }, { status: 400 })
          }

          const manufacturer = await ensureManufacturer(manufacturerName)
          await db
            .update(yarnLines)
            .set({
              manufacturerId: manufacturer.id,
              name: lineName,
              weightClass: normalizeText(body.weightClass),
              fiberContent: normalizeText(body.fiberContent),
              yardageMeters: normalizeInteger(body.yardageMeters),
              needleOrHookRange: normalizeText(body.needleOrHookRange),
              productUrl: normalizeOptionalUrl(body.productUrl ?? null),
              updatedAt: Date.now(),
            })
            .where(eq(yarnLines.id, params.lineId))

          return Response.json({ message: 'Yarn line updated.' }, { status: 200 })
        }

        if (body.entityType === 'colorway') {
          const colorwayId = body.entityId?.trim() ?? ''
          if (!colorwayId || !body.name?.trim()) {
            return Response.json({ message: 'Colorway id and name are required.' }, { status: 400 })
          }

          await db
            .update(yarnColorways)
            .set({
              name: body.name.trim(),
              colorCode: normalizeText(body.colorCode),
              hexReference: normalizeText(body.hexReference),
              updatedAt: Date.now(),
            })
            .where(and(eq(yarnColorways.id, colorwayId), eq(yarnColorways.yarnLineId, params.lineId)))

          return Response.json({ message: 'Colorway updated.' }, { status: 200 })
        }

        if (body.entityType === 'barcode') {
          const barcodeId = body.entityId?.trim() ?? ''
          const barcodeValue = normalizeBarcode(body.barcodeValue ?? '')
          if (!barcodeId || !barcodeValue) {
            return Response.json({ message: 'Barcode id and valid barcode value are required.' }, { status: 400 })
          }

          const colorwayId = body.colorwayId?.trim() || null
          await db
            .update(barcodes)
            .set({
              barcodeValue,
              format: inferBarcodeFormat(barcodeValue),
              yarnLineId: params.lineId,
              yarnColorwayId: colorwayId,
              updatedAt: Date.now(),
            })
            .where(and(eq(barcodes.id, barcodeId), eq(barcodes.yarnLineId, params.lineId)))

          return Response.json({ message: 'Barcode updated.' }, { status: 200 })
        }

        return Response.json({ message: 'Unsupported entityType.' }, { status: 400 })
      },
      DELETE: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        if (authUser.role !== 'admin') return Response.json({ message: 'Forbidden' }, { status: 403 })

        const db = getDb()
        const body = (await request.json()) as {
          entityType?: 'line' | 'colorway' | 'barcode' | 'manufacturer'
          entityId?: string
          confirmName?: string
        }
        const entityId = body.entityId?.trim() ?? ''

        if (body.entityType === 'line') {
          await db.delete(yarnLines).where(eq(yarnLines.id, params.lineId))
          return Response.json({ message: 'Yarn line deleted.' }, { status: 200 })
        }

        if (body.entityType === 'manufacturer') {
          const currentLine = await db
            .select({ manufacturerId: yarnLines.manufacturerId, manufacturerName: manufacturers.name })
            .from(yarnLines)
            .innerJoin(manufacturers, eq(yarnLines.manufacturerId, manufacturers.id))
            .where(eq(yarnLines.id, params.lineId))
            .limit(1)

          if (!currentLine[0]) {
            return Response.json({ message: 'Catalog line not found.' }, { status: 404 })
          }

          const confirmName = body.confirmName?.trim() ?? ''
          if (confirmName.toLowerCase() !== currentLine[0].manufacturerName.toLowerCase()) {
            return Response.json({ message: 'Confirmation name did not match manufacturer.' }, { status: 400 })
          }

          await db.delete(manufacturers).where(eq(manufacturers.id, currentLine[0].manufacturerId))
          return Response.json({ message: 'Manufacturer and all related catalog lines were deleted.' }, { status: 200 })
        }

        if (!entityId) {
          return Response.json({ message: 'entityId is required.' }, { status: 400 })
        }

        if (body.entityType === 'colorway') {
          await db.delete(yarnColorways).where(and(eq(yarnColorways.id, entityId), eq(yarnColorways.yarnLineId, params.lineId)))
          return Response.json({ message: 'Colorway deleted.' }, { status: 200 })
        }

        if (body.entityType === 'barcode') {
          await db.delete(barcodes).where(and(eq(barcodes.id, entityId), eq(barcodes.yarnLineId, params.lineId)))
          return Response.json({ message: 'Barcode deleted.' }, { status: 200 })
        }

        return Response.json({ message: 'Unsupported entityType.' }, { status: 400 })
      },
    },
  },
})

function normalizeText(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeInteger(value: number | null | undefined) {
  const next = Number(value)
  return Number.isFinite(next) && next > 0 ? Math.round(next) : null
}

function normalizeBarcode(raw: string) {
  const onlyDigits = raw.replace(/\D/g, '')
  return onlyDigits.length >= 8 ? onlyDigits : null
}

function inferBarcodeFormat(value: string) {
  if (value.length === 8) return 'ean_8'
  if (value.length === 12) return 'upc_a'
  if (value.length === 13) return 'ean_13'
  return 'unknown'
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function ensureManufacturer(name: string) {
  const db = getDb()
  const existing = await db.query.manufacturers.findFirst({ where: eq(manufacturers.name, name) })
  if (existing) return existing

  const base = slugify(name) || `manufacturer-${crypto.randomUUID().slice(0, 8)}`
  let candidate = base
  let index = 2
  while (await db.query.manufacturers.findFirst({ where: eq(manufacturers.slug, candidate) })) {
    candidate = `${base}-${index}`
    index += 1
  }

  const id = crypto.randomUUID()
  await db.insert(manufacturers).values({ id, name, slug: candidate })
  return { id, name, slug: candidate }
}

function normalizeOptionalUrl(value: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}
