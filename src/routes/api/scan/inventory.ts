import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'
import {
  creationHooks,
  creationImages,
  creationYarn,
  patternLibraryLinks,
  creations,
  hooks,
  inventoryYarn,
  manufacturers,
  patterns,
  users,
  yarnColorways,
  yarnLines,
} from '#/lib/db/schema'

type InventoryKind = 'yarn' | 'hooks' | 'patterns' | 'creations'

export const Route = createFileRoute('/api/scan/inventory')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const query = (url.searchParams.get('query') ?? '').trim().toLowerCase()
        const kind = parseKind(url.searchParams.get('kind'))

        if (kind === 'hooks') {
          return getHooks(authUser.id, query)
        }
        if (kind === 'patterns') {
          return getPatterns(authUser.id, query)
        }
        if (kind === 'creations') {
          return getCreations(authUser.id, query)
        }
        return getYarn(authUser.id, query)
      },
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as Record<string, unknown>
        const kind = parseKind(typeof body.kind === 'string' ? body.kind : null)

        if (kind === 'hooks') {
          const sizeLabel = typeof body.sizeLabel === 'string' ? body.sizeLabel.trim() : ''
          if (!sizeLabel) {
            return Response.json({ message: 'sizeLabel is required.' }, { status: 400 })
          }
          const quantity = normalizeQuantity(body.quantity, 1)
          await getDb().insert(hooks).values({
            id: crypto.randomUUID(),
            userId: authUser.id,
            sizeLabel,
            metricSizeMm: typeof body.metricSizeMm === 'string' ? body.metricSizeMm.trim() || null : null,
            material: typeof body.material === 'string' ? body.material.trim() || null : null,
            quantity,
          })
          return Response.json({ message: 'Hook added.' }, { status: 201 })
        }

        if (kind === 'patterns') {
          const title = typeof body.title === 'string' ? body.title.trim() : ''
          if (!title) {
            return Response.json({ message: 'title is required.' }, { status: 400 })
          }
          const isPublic = Boolean(body.isPublic)
          const publicShareConfirmed = Boolean(body.publicShareConfirmed)
          if (isPublic && !publicShareConfirmed) {
            return Response.json(
              { message: 'You must confirm creator/permission before making a pattern public.' },
              { status: 400 },
            )
          }

          const patternId = crypto.randomUUID()
          await getDb().insert(patterns).values({
            id: patternId,
            userId: authUser.id,
            title,
            description: typeof body.description === 'string' ? body.description.trim() || null : null,
            sourceUrl: normalizeOptionalUrl(typeof body.sourceUrl === 'string' ? body.sourceUrl : null),
            difficulty: typeof body.difficulty === 'string' ? body.difficulty.trim() || null : null,
            isPublic,
            publicShareConfirmed,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
          })
          return Response.json({ message: 'Pattern added.', patternId }, { status: 201 })
        }

        if (kind === 'creations') {
          const name = typeof body.name === 'string' ? body.name.trim() : ''
          if (!name) {
            return Response.json({ message: 'name is required.' }, { status: 400 })
          }
          const status = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : 'active'
          const creationId = crypto.randomUUID()
          await getDb().insert(creations).values({
            id: creationId,
            userId: authUser.id,
            patternId: typeof body.patternId === 'string' ? body.patternId || null : null,
            name,
            status,
            isPublic: Boolean(body.isPublic),
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
            finishedAt: status === 'finished' ? Date.now() : null,
          })

          const yarnInventoryIds = Array.isArray(body.yarnInventoryIds)
            ? body.yarnInventoryIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
            : []
          if (yarnInventoryIds.length) {
            const ownedYarn = await getDb()
              .select({ id: inventoryYarn.id })
              .from(inventoryYarn)
              .where(and(eq(inventoryYarn.userId, authUser.id), inArray(inventoryYarn.id, yarnInventoryIds)))
            const ownedYarnIds = new Set(ownedYarn.map((row) => row.id))
            if (ownedYarnIds.size) {
              await getDb().insert(creationYarn).values(
                [...ownedYarnIds].map((inventoryYarnId) => ({
                  creationId,
                  inventoryYarnId,
                  skeinsUsed: 1,
                })),
              )
            }
          }

          const hookIds = Array.isArray(body.hookIds)
            ? body.hookIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
            : []
          if (hookIds.length) {
            const ownedHooks = await getDb()
              .select({ id: hooks.id })
              .from(hooks)
              .where(and(eq(hooks.userId, authUser.id), inArray(hooks.id, hookIds)))
            const ownedHookIds = new Set(ownedHooks.map((row) => row.id))
            if (ownedHookIds.size) {
              await getDb().insert(creationHooks).values(
                [...ownedHookIds].map((hookId) => ({
                  creationId,
                  hookId,
                })),
              )
            }
          }

          return Response.json({ message: 'Creation added.', creationId }, { status: 201 })
        }

        const lineId = typeof body.lineId === 'string' ? body.lineId.trim() : ''
        if (!lineId) {
          return Response.json({ message: 'lineId is required.' }, { status: 400 })
        }
        const quantity = normalizeQuantity(body.quantity, 1)

        await getDb().insert(inventoryYarn).values({
          id: crypto.randomUUID(),
          userId: authUser.id,
          yarnLineId: lineId,
          yarnColorwayId: typeof body.colorwayId === 'string' ? body.colorwayId || null : null,
          nickname: typeof body.nickname === 'string' ? body.nickname.trim() || null : null,
          quantity,
          isLowStock: Boolean(body.isLowStock),
          isProjectReserved: Boolean(body.isProjectReserved),
          storageLocation: typeof body.storageLocation === 'string' ? body.storageLocation.trim() || null : null,
          notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
        })

        return Response.json({ message: 'Added to inventory.' }, { status: 201 })
      },
      PATCH: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as Record<string, unknown>
        const itemId = typeof body.itemId === 'string' ? body.itemId : ''
        if (!itemId) {
          return Response.json({ message: 'itemId is required.' }, { status: 400 })
        }

        const kind = parseKind(typeof body.kind === 'string' ? body.kind : null)

        if (kind === 'hooks') {
          const updatePayload: {
            sizeLabel?: string
            metricSizeMm?: string | null
            material?: string | null
            quantity?: number
            updatedAt: number
          } = { updatedAt: Date.now() }
          if (typeof body.sizeLabel === 'string' && body.sizeLabel.trim()) updatePayload.sizeLabel = body.sizeLabel.trim()
          if (typeof body.metricSizeMm !== 'undefined') updatePayload.metricSizeMm = typeof body.metricSizeMm === 'string' ? body.metricSizeMm.trim() || null : null
          if (typeof body.material !== 'undefined') updatePayload.material = typeof body.material === 'string' ? body.material.trim() || null : null
          if (typeof body.quantity !== 'undefined') updatePayload.quantity = normalizeQuantity(body.quantity, 1)

          await getDb().update(hooks).set(updatePayload).where(and(eq(hooks.id, itemId), eq(hooks.userId, authUser.id)))
          return Response.json({ message: 'Hook updated.' }, { status: 200 })
        }

        if (kind === 'patterns') {
          const existing = await getDb().query.patterns.findFirst({ where: and(eq(patterns.id, itemId), eq(patterns.userId, authUser.id)) })
          if (!existing) {
            const linked = await getDb().query.patternLibraryLinks.findFirst({ where: and(eq(patternLibraryLinks.patternId, itemId), eq(patternLibraryLinks.userId, authUser.id)) })
            if (!linked) {
              return Response.json({ message: 'Pattern not found.' }, { status: 404 })
            }
            return Response.json({ message: 'Linked patterns are read-only. Remove from library to edit.' }, { status: 400 })
          }

          const updatePayload: {
            title?: string
            description?: string | null
            sourceUrl?: string | null
            difficulty?: string | null
            isPublic?: boolean
            publicShareConfirmed?: boolean
            notes?: string | null
            updatedAt: number
          } = { updatedAt: Date.now() }
          if (typeof body.title === 'string' && body.title.trim()) updatePayload.title = body.title.trim()
          if (typeof body.description !== 'undefined') updatePayload.description = typeof body.description === 'string' ? body.description.trim() || null : null
          if (typeof body.sourceUrl !== 'undefined') updatePayload.sourceUrl = normalizeOptionalUrl(typeof body.sourceUrl === 'string' ? body.sourceUrl : null)
          if (typeof body.difficulty !== 'undefined') updatePayload.difficulty = typeof body.difficulty === 'string' ? body.difficulty.trim() || null : null
          if (typeof body.isPublic !== 'undefined') updatePayload.isPublic = Boolean(body.isPublic)
          if (typeof body.publicShareConfirmed !== 'undefined') updatePayload.publicShareConfirmed = Boolean(body.publicShareConfirmed)
          if (typeof body.notes !== 'undefined') updatePayload.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

          const nextIsPublic = typeof updatePayload.isPublic === 'boolean' ? updatePayload.isPublic : existing.isPublic
          const nextShareConfirmed =
            typeof updatePayload.publicShareConfirmed === 'boolean' ? updatePayload.publicShareConfirmed : existing.publicShareConfirmed
          if (nextIsPublic && !nextShareConfirmed) {
            return Response.json(
              { message: 'You must confirm creator/permission before making a pattern public.' },
              { status: 400 },
            )
          }

          await getDb().update(patterns).set(updatePayload).where(and(eq(patterns.id, itemId), eq(patterns.userId, authUser.id)))
          return Response.json({ message: 'Pattern updated.' }, { status: 200 })
        }

        if (kind === 'creations') {
          const existingCreation = await getDb().query.creations.findFirst({
            where: and(eq(creations.id, itemId), eq(creations.userId, authUser.id)),
          })
          if (!existingCreation) {
            return Response.json({ message: 'Creation not found.' }, { status: 404 })
          }

          const updatePayload: {
            name?: string
            patternId?: string | null
            status?: string
            isPublic?: boolean
            notes?: string | null
            finishedAt?: number | null
            updatedAt: number
          } = { updatedAt: Date.now() }
          if (typeof body.name === 'string' && body.name.trim()) updatePayload.name = body.name.trim()
          if (typeof body.patternId !== 'undefined') updatePayload.patternId = typeof body.patternId === 'string' ? body.patternId || null : null
          if (typeof body.status === 'string' && body.status.trim()) {
            updatePayload.status = body.status.trim()
            updatePayload.finishedAt = body.status.trim() === 'finished' ? Date.now() : null
          }
          if (typeof body.isPublic !== 'undefined') updatePayload.isPublic = Boolean(body.isPublic)
          if (typeof body.notes !== 'undefined') updatePayload.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

          await getDb().update(creations).set(updatePayload).where(and(eq(creations.id, itemId), eq(creations.userId, authUser.id)))

          if (Array.isArray(body.yarnInventoryIds)) {
            const requestedIds = body.yarnInventoryIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            const ownedYarn = requestedIds.length
              ? await getDb()
                  .select({ id: inventoryYarn.id })
                  .from(inventoryYarn)
                  .where(and(eq(inventoryYarn.userId, authUser.id), inArray(inventoryYarn.id, requestedIds)))
              : []
            const ownedYarnIds = new Set(ownedYarn.map((row) => row.id))
            const nextYarnIds = requestedIds.filter((id) => ownedYarnIds.has(id))

            await getDb().delete(creationYarn).where(eq(creationYarn.creationId, itemId))
            if (nextYarnIds.length) {
              await getDb().insert(creationYarn).values(
                nextYarnIds.map((yarnId) => ({
                  creationId: itemId,
                  inventoryYarnId: yarnId,
                  skeinsUsed: 1,
                })),
              )
            }
          }

          if (Array.isArray(body.hookIds)) {
            const requestedIds = body.hookIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            const ownedHooks = requestedIds.length
              ? await getDb()
                  .select({ id: hooks.id })
                  .from(hooks)
                  .where(and(eq(hooks.userId, authUser.id), inArray(hooks.id, requestedIds)))
              : []
            const ownedHookIds = new Set(ownedHooks.map((row) => row.id))
            const nextHookIds = requestedIds.filter((id) => ownedHookIds.has(id))

            await getDb().delete(creationHooks).where(eq(creationHooks.creationId, itemId))
            if (nextHookIds.length) {
              await getDb().insert(creationHooks).values(
                nextHookIds.map((hookId) => ({
                  creationId: itemId,
                  hookId,
                })),
              )
            }
          }

          return Response.json({ message: 'Creation updated.' }, { status: 200 })
        }

        const updatePayload: {
          quantity?: number
          storageLocation?: string | null
          nickname?: string | null
          notes?: string | null
          isLowStock?: boolean
          isProjectReserved?: boolean
          updatedAt: number
        } = {
          updatedAt: Date.now(),
        }

        if (typeof body.quantity !== 'undefined') updatePayload.quantity = normalizeQuantity(body.quantity, 1)
        if (typeof body.storageLocation !== 'undefined') updatePayload.storageLocation = typeof body.storageLocation === 'string' ? body.storageLocation.trim() || null : null
        if (typeof body.nickname !== 'undefined') updatePayload.nickname = typeof body.nickname === 'string' ? body.nickname.trim() || null : null
        if (typeof body.notes !== 'undefined') updatePayload.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
        if (typeof body.isLowStock !== 'undefined') updatePayload.isLowStock = Boolean(body.isLowStock)
        if (typeof body.isProjectReserved !== 'undefined') updatePayload.isProjectReserved = Boolean(body.isProjectReserved)

        await getDb()
          .update(inventoryYarn)
          .set(updatePayload)
          .where(and(eq(inventoryYarn.id, itemId), eq(inventoryYarn.userId, authUser.id)))

        return Response.json({ message: 'Inventory item updated.' }, { status: 200 })
      },
      DELETE: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as { kind?: InventoryKind; itemId?: string }
        if (!body.itemId) {
          return Response.json({ message: 'itemId is required.' }, { status: 400 })
        }

        const kind = parseKind(body.kind ?? null)
        if (kind === 'hooks') {
          await getDb().delete(hooks).where(and(eq(hooks.id, body.itemId), eq(hooks.userId, authUser.id)))
          return Response.json({ message: 'Hook removed.' }, { status: 200 })
        }
        if (kind === 'patterns') {
          const pattern = await getDb().query.patterns.findFirst({
            where: and(eq(patterns.id, body.itemId), eq(patterns.userId, authUser.id)),
          })
          if (!pattern) {
            await getDb().delete(patternLibraryLinks).where(and(eq(patternLibraryLinks.patternId, body.itemId), eq(patternLibraryLinks.userId, authUser.id)))
            return Response.json({ message: 'Pattern removed from your library.' }, { status: 200 })
          }

          await deleteR2Objects([pattern.pdfR2Key, pattern.pdfPreviewR2Key, pattern.coverR2Key])
          await getDb().delete(patterns).where(and(eq(patterns.id, body.itemId), eq(patterns.userId, authUser.id)))
          return Response.json({ message: 'Pattern removed.' }, { status: 200 })
        }
        if (kind === 'creations') {
          const creation = await getDb().query.creations.findFirst({
            where: and(eq(creations.id, body.itemId), eq(creations.userId, authUser.id)),
          })
          if (!creation) {
            return Response.json({ message: 'Creation not found.' }, { status: 404 })
          }

          const imageRows = await getDb()
            .select({ r2Key: creationImages.r2Key })
            .from(creationImages)
            .where(and(eq(creationImages.creationId, creation.id), eq(creationImages.userId, authUser.id)))

          await deleteR2Objects(imageRows.map((row) => row.r2Key))
          await getDb().delete(creations).where(and(eq(creations.id, body.itemId), eq(creations.userId, authUser.id)))
          return Response.json({ message: 'Creation removed.' }, { status: 200 })
        }

        await getDb()
          .delete(inventoryYarn)
          .where(and(eq(inventoryYarn.id, body.itemId), eq(inventoryYarn.userId, authUser.id)))

        return Response.json({ message: 'Inventory item removed.' }, { status: 200 })
      },
    },
  },
})

async function getYarn(userId: string, query: string) {
  const db = getDb()
  const whereClause = query
    ? and(
        eq(inventoryYarn.userId, userId),
        sql`(
          lower(coalesce(${manufacturers.name}, '')) like ${`%${query}%`}
          or lower(coalesce(${yarnLines.name}, '')) like ${`%${query}%`}
          or lower(coalesce(${yarnColorways.name}, '')) like ${`%${query}%`}
          or lower(coalesce(${inventoryYarn.storageLocation}, '')) like ${`%${query}%`}
          or lower(coalesce(${inventoryYarn.notes}, '')) like ${`%${query}%`}
        )`,
      )
    : eq(inventoryYarn.userId, userId)

  const rows = await db
    .select({
      id: inventoryYarn.id,
      yarnLineId: inventoryYarn.yarnLineId,
      yarnColorwayId: inventoryYarn.yarnColorwayId,
      nickname: inventoryYarn.nickname,
      quantity: inventoryYarn.quantity,
      isLowStock: inventoryYarn.isLowStock,
      isProjectReserved: inventoryYarn.isProjectReserved,
      storageLocation: inventoryYarn.storageLocation,
      notes: inventoryYarn.notes,
      updatedAt: inventoryYarn.updatedAt,
      lineName: yarnLines.name,
      manufacturerName: manufacturers.name,
      colorwayName: yarnColorways.name,
      colorCode: yarnColorways.colorCode,
    })
    .from(inventoryYarn)
    .leftJoin(yarnLines, eq(inventoryYarn.yarnLineId, yarnLines.id))
    .leftJoin(manufacturers, eq(yarnLines.manufacturerId, manufacturers.id))
    .leftJoin(yarnColorways, eq(inventoryYarn.yarnColorwayId, yarnColorways.id))
    .where(whereClause)
    .orderBy(desc(inventoryYarn.updatedAt))

  const uniqueLines = new Set(rows.map((row) => row.yarnLineId).filter((value): value is string => Boolean(value))).size
  const uniqueColorways = new Set(rows.map((row) => row.yarnColorwayId).filter((value): value is string => Boolean(value))).size
  const totalQuantity = rows.reduce((acc, row) => acc + (Number(row.quantity) || 0), 0)
  const lowStock = rows.filter((item) => item.isLowStock).length
  const reserved = rows.filter((item) => item.isProjectReserved).length

  return Response.json(
    {
      kind: 'yarn',
      summary: {
        entries: rows.length,
        totalQuantity,
        uniqueLines,
        uniqueColorways,
        lowStock,
        reserved,
      },
      items: rows,
    },
    { status: 200 },
  )
}

async function deleteR2Objects(keys: Array<string | null | undefined>) {
  const validKeys = keys.filter((key): key is string => Boolean(key))
  if (!validKeys.length) {
    return
  }

  const bucket = getServerEnv().R2_BUCKET
  const client = getR2Client()
  const deletions = validKeys.map((key) =>
    client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    ),
  )

  const results = await Promise.allSettled(deletions)
  const failed = results.find((result) => result.status === 'rejected')
  if (failed && failed.status === 'rejected') {
    throw failed.reason
  }
}

async function getHooks(userId: string, query: string) {
  const db = getDb()
  const whereClause = query
    ? and(
        eq(hooks.userId, userId),
        sql`(
          lower(coalesce(${hooks.sizeLabel}, '')) like ${`%${query}%`}
          or lower(coalesce(${hooks.metricSizeMm}, '')) like ${`%${query}%`}
          or lower(coalesce(${hooks.material}, '')) like ${`%${query}%`}
        )`,
      )
    : eq(hooks.userId, userId)

  const rows = await db
    .select({
      id: hooks.id,
      sizeLabel: hooks.sizeLabel,
      metricSizeMm: hooks.metricSizeMm,
      material: hooks.material,
      quantity: hooks.quantity,
      updatedAt: hooks.updatedAt,
    })
    .from(hooks)
    .where(whereClause)
    .orderBy(desc(hooks.updatedAt))

  const totalQuantity = rows.reduce((acc, row) => acc + (Number(row.quantity) || 0), 0)

  return Response.json(
    {
      kind: 'hooks',
      summary: { entries: rows.length, totalQuantity },
      items: rows,
    },
    { status: 200 },
  )
}

async function getPatterns(userId: string, query: string) {
  const db = getDb()
  const whereClause = query
    ? and(
        eq(patterns.userId, userId),
        sql`(
          lower(coalesce(${patterns.title}, '')) like ${`%${query}%`}
          or lower(coalesce(${patterns.description}, '')) like ${`%${query}%`}
          or lower(coalesce(${patterns.difficulty}, '')) like ${`%${query}%`}
          or lower(coalesce(${patterns.notes}, '')) like ${`%${query}%`}
        )`,
      )
    : eq(patterns.userId, userId)

  const rows = await db
    .select({
      id: patterns.id,
      title: patterns.title,
      description: patterns.description,
      sourceUrl: patterns.sourceUrl,
      difficulty: patterns.difficulty,
      isPublic: patterns.isPublic,
      publicShareConfirmed: patterns.publicShareConfirmed,
      hasPdf: sql<boolean>`case when ${patterns.pdfR2Key} is not null then 1 else 0 end`,
      hasPdfPreview: sql<boolean>`case when ${patterns.pdfPreviewR2Key} is not null then 1 else 0 end`,
      hasCover: sql<boolean>`case when ${patterns.coverR2Key} is not null then 1 else 0 end`,
      pdfFileName: patterns.pdfFileName,
      moderationStatus: patterns.moderationStatus,
      moderationReason: patterns.moderationReason,
      notes: patterns.notes,
      updatedAt: patterns.updatedAt,
    })
    .from(patterns)
    .where(whereClause)
    .orderBy(desc(patterns.updatedAt))

  const linkedRows = await db
    .select({
      id: patterns.id,
      title: patterns.title,
      description: patterns.description,
      sourceUrl: patterns.sourceUrl,
      difficulty: patterns.difficulty,
      isPublic: patterns.isPublic,
      publicShareConfirmed: patterns.publicShareConfirmed,
      hasPdf: sql<boolean>`case when ${patterns.pdfR2Key} is not null then 1 else 0 end`,
      hasPdfPreview: sql<boolean>`case when ${patterns.pdfPreviewR2Key} is not null then 1 else 0 end`,
      hasCover: sql<boolean>`case when ${patterns.coverR2Key} is not null then 1 else 0 end`,
      pdfFileName: patterns.pdfFileName,
      moderationStatus: patterns.moderationStatus,
      moderationReason: patterns.moderationReason,
      notes: patterns.notes,
      updatedAt: patterns.updatedAt,
      ownerDisplayName: users.displayName,
    })
    .from(patternLibraryLinks)
    .innerJoin(patterns, eq(patternLibraryLinks.patternId, patterns.id))
    .innerJoin(users, eq(patterns.userId, users.id))
    .where(and(eq(patternLibraryLinks.userId, userId), query ? sql`(
      lower(coalesce(${patterns.title}, '')) like ${`%${query}%`}
      or lower(coalesce(${patterns.description}, '')) like ${`%${query}%`}
      or lower(coalesce(${patterns.difficulty}, '')) like ${`%${query}%`}
      or lower(coalesce(${users.displayName}, '')) like ${`%${query}%`}
    )` : sql`1=1`))
    .orderBy(desc(patterns.updatedAt))

  const merged = [...rows.map((row) => ({ ...row, isLinked: false, ownerDisplayName: null })), ...linkedRows.map((row) => ({ ...row, isLinked: true }))]
  const deduped = new Map<string, any>()
  for (const row of merged) {
    if (!deduped.has(row.id) || !row.isLinked) deduped.set(row.id, row)
  }

  return Response.json(
    {
      kind: 'patterns',
      summary: { entries: deduped.size },
      items: Array.from(deduped.values()),
    },
    { status: 200 },
  )
}

async function getCreations(userId: string, query: string) {
  const db = getDb()
  const whereClause = query
    ? and(
        eq(creations.userId, userId),
        sql`(
          lower(coalesce(${creations.name}, '')) like ${`%${query}%`}
          or lower(coalesce(${creations.status}, '')) like ${`%${query}%`}
          or lower(coalesce(${creations.notes}, '')) like ${`%${query}%`}
        )`,
      )
    : eq(creations.userId, userId)

  const rows = await db
    .select({
      id: creations.id,
      name: creations.name,
      status: creations.status,
      isPublic: creations.isPublic,
      moderationStatus: creations.moderationStatus,
      moderationReason: creations.moderationReason,
      notes: creations.notes,
      patternId: creations.patternId,
      patternTitle: patterns.title,
      finishedAt: creations.finishedAt,
      updatedAt: creations.updatedAt,
    })
    .from(creations)
    .leftJoin(patterns, eq(creations.patternId, patterns.id))
    .where(whereClause)
    .orderBy(desc(creations.updatedAt))

  const creationIds = rows.map((row) => row.id)

  const yarnLinkCounts = creationIds.length
    ? await db
        .select({
          creationId: creationYarn.creationId,
          count: sql<number>`count(*)`,
        })
        .from(creationYarn)
        .where(inArray(creationYarn.creationId, creationIds))
        .groupBy(creationYarn.creationId)
    : []

  const yarnLinks = creationIds.length
    ? await db
        .select({
          creationId: creationYarn.creationId,
          inventoryYarnId: creationYarn.inventoryYarnId,
        })
        .from(creationYarn)
        .where(inArray(creationYarn.creationId, creationIds))
    : []

  const hookLinkCounts = creationIds.length
    ? await db
        .select({
          creationId: creationHooks.creationId,
          count: sql<number>`count(*)`,
        })
        .from(creationHooks)
        .where(inArray(creationHooks.creationId, creationIds))
        .groupBy(creationHooks.creationId)
    : []

  const hookLinks = creationIds.length
    ? await db
        .select({
          creationId: creationHooks.creationId,
          hookId: creationHooks.hookId,
        })
        .from(creationHooks)
        .where(inArray(creationHooks.creationId, creationIds))
    : []

  const imageCounts = creationIds.length
    ? await db
        .select({
          creationId: creationImages.creationId,
          count: sql<number>`count(*)`,
        })
        .from(creationImages)
        .where(inArray(creationImages.creationId, creationIds))
        .groupBy(creationImages.creationId)
    : []

  const previewImages = creationIds.length
    ? await db
        .select({
          creationId: creationImages.creationId,
          imageId: creationImages.id,
          createdAt: creationImages.createdAt,
        })
        .from(creationImages)
        .where(inArray(creationImages.creationId, creationIds))
        .orderBy(desc(creationImages.createdAt))
    : []

  const yarnCountMap = new Map(yarnLinkCounts.map((row) => [row.creationId, Number(row.count) || 0]))
  const hookCountMap = new Map(hookLinkCounts.map((row) => [row.creationId, Number(row.count) || 0]))
  const imageCountMap = new Map(imageCounts.map((row) => [row.creationId, Number(row.count) || 0]))
  const yarnIdsMap = new Map<string, string[]>()
  for (const row of yarnLinks) {
    const list = yarnIdsMap.get(row.creationId) ?? []
    list.push(row.inventoryYarnId)
    yarnIdsMap.set(row.creationId, list)
  }
  const hookIdsMap = new Map<string, string[]>()
  for (const row of hookLinks) {
    const list = hookIdsMap.get(row.creationId) ?? []
    list.push(row.hookId)
    hookIdsMap.set(row.creationId, list)
  }
  const previewMap = new Map<string, string[]>()
  for (const image of previewImages) {
    const list = previewMap.get(image.creationId) ?? []
    if (list.length < 4) {
      list.push(`/api/creations/${image.creationId}/images?imageId=${image.imageId}`)
      previewMap.set(image.creationId, list)
    }
  }

  const rowsWithCounts = rows.map((row) => ({
    ...row,
    yarnCount: yarnCountMap.get(row.id) ?? 0,
    hookCount: hookCountMap.get(row.id) ?? 0,
    imageCount: imageCountMap.get(row.id) ?? 0,
    imagePreviews: previewMap.get(row.id) ?? [],
    yarnInventoryIds: yarnIdsMap.get(row.id) ?? [],
    hookIds: hookIdsMap.get(row.id) ?? [],
  }))

  const finished = rowsWithCounts.filter((row) => row.status === 'finished').length

  return Response.json(
    {
      kind: 'creations',
      summary: { entries: rows.length, finished },
      items: rowsWithCounts,
    },
    { status: 200 },
  )
}

function parseKind(kind: string | null): InventoryKind {
  if (kind === 'hooks' || kind === 'patterns' || kind === 'creations') {
    return kind
  }
  return 'yarn'
}

function normalizeQuantity(quantity: unknown, fallback: number) {
  return Number.isFinite(quantity) && Number(quantity) > 0 ? Math.round(Number(quantity)) : fallback
}

function normalizeOptionalUrl(value: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  return `https://${trimmed}`
}
