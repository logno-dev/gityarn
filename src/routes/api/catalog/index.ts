import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { barcodes, manufacturers, yarnColorways, yarnLines } from '#/lib/db/schema'

export const Route = createFileRoute('/api/catalog/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const url = new URL(request.url)
        const query = url.searchParams.get('query')?.trim() ?? ''
        const weightClass = url.searchParams.get('weightClass')?.trim() ?? 'all'
        const hasBarcodesFilter = url.searchParams.get('hasBarcodes')?.trim() ?? 'any'
        const lowerQuery = query.toLowerCase()
        const pageRaw = Number(url.searchParams.get('page') ?? 1)
        const requestedPage = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1
        const limitRaw = Number(url.searchParams.get('limit') ?? 60)
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 10), 200) : 60

        const whereClauses: Array<ReturnType<typeof sql>> = []
        if (query.length) {
          whereClauses.push(sql`(
            lower(${yarnLines.name}) like ${`%${lowerQuery}%`}
            or lower(${manufacturers.name}) like ${`%${lowerQuery}%`}
            or lower(coalesce(${yarnLines.fiberContent}, '')) like ${`%${lowerQuery}%`}
          )`)
        }
        if (weightClass && weightClass !== 'all') {
          whereClauses.push(sql`${yarnLines.weightClass} = ${weightClass}`)
        }
        if (hasBarcodesFilter === 'yes') {
          whereClauses.push(sql`exists (select 1 from barcodes where barcodes.yarn_line_id = ${yarnLines.id})`)
        }
        if (hasBarcodesFilter === 'no') {
          whereClauses.push(sql`not exists (select 1 from barcodes where barcodes.yarn_line_id = ${yarnLines.id})`)
        }

        const whereClause =
          whereClauses.length === 0
            ? undefined
            : whereClauses.length === 1
              ? whereClauses[0]
              : and(...(whereClauses as [ReturnType<typeof sql>, ReturnType<typeof sql>, ...Array<ReturnType<typeof sql>>]))

        const [filteredLineTotalRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(yarnLines)
          .innerJoin(manufacturers, eq(yarnLines.manufacturerId, manufacturers.id))
          .where(whereClause)

        const filteredTotal = Number(filteredLineTotalRow?.count) || 0
        const totalPages = Math.max(1, Math.ceil(filteredTotal / limit))
        const page = Math.min(requestedPage, totalPages)
        const offset = (page - 1) * limit

        const lines = await db
          .select({
            id: yarnLines.id,
            name: yarnLines.name,
            manufacturerName: manufacturers.name,
            weightClass: yarnLines.weightClass,
            fiberContent: yarnLines.fiberContent,
            yardageMeters: yarnLines.yardageMeters,
            productUrl: yarnLines.productUrl,
          })
          .from(yarnLines)
          .innerJoin(manufacturers, eq(yarnLines.manufacturerId, manufacturers.id))
          .where(whereClause)
          .orderBy(desc(yarnLines.createdAt))
          .offset(offset)
          .limit(limit)

        const lineIds = lines.map((line) => line.id)

        const colorCounts = lineIds.length
          ? await db
              .select({
                lineId: yarnColorways.yarnLineId,
                count: sql<number>`count(*)`,
              })
              .from(yarnColorways)
              .where(inArray(yarnColorways.yarnLineId, lineIds))
              .groupBy(yarnColorways.yarnLineId)
          : []

        const barcodeCounts = lineIds.length
          ? await db
              .select({
                lineId: barcodes.yarnLineId,
                count: sql<number>`count(*)`,
              })
              .from(barcodes)
              .where(and(isNotNull(barcodes.yarnLineId), inArray(barcodes.yarnLineId, lineIds)))
              .groupBy(barcodes.yarnLineId)
          : []

        const colorCountMap = new Map(colorCounts.map((item) => [item.lineId, Number(item.count) || 0]))
        const barcodeCountMap = new Map(barcodeCounts.map((item) => [item.lineId, Number(item.count) || 0]))

        const linesWithCounts = lines.map((line) => ({
          ...line,
          colorwayCount: colorCountMap.get(line.id) ?? 0,
          barcodeCount: barcodeCountMap.get(line.id) ?? 0,
        }))

        const weightClassRows = await db
          .selectDistinct({ weightClass: yarnLines.weightClass })
          .from(yarnLines)
          .where(isNotNull(yarnLines.weightClass))
          .orderBy(asc(yarnLines.weightClass))

        const [manufacturerTotalRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(manufacturers)
        const [lineTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(yarnLines)
        const [colorwayTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(yarnColorways)
        const [barcodeTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(barcodes)

        return Response.json(
          {
            summary: {
              manufacturers: Number(manufacturerTotalRow?.count) || 0,
              yarnLines: Number(lineTotalRow?.count) || 0,
              colorways: Number(colorwayTotalRow?.count) || 0,
              barcodes: Number(barcodeTotalRow?.count) || 0,
            },
            filterOptions: {
              weightClasses: weightClassRows
                .map((row) => row.weightClass)
                .filter((row): row is string => Boolean(row)),
            },
            pagination: {
              page,
              pageSize: limit,
              totalItems: filteredTotal,
              totalPages,
              hasPreviousPage: page > 1,
              hasNextPage: page < totalPages,
            },
            lines: linesWithCounts,
          },
          { status: 200 },
        )
      },
    },
  },
})
