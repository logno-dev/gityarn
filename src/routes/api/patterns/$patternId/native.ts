import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { and, asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { nativePatternColors, nativePatternRows, nativePatternSections, patterns } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { normalizeNativeBlockStyle, normalizeNativePatternStyle } from '#/lib/patterns/native-document'
import { normalizeNativeSectionType, reconcileNativeGridLayout } from '#/lib/patterns/native-layout'
import { parsePatternStep } from '#/lib/patterns/native-parser'
import type { PatternStepType } from '#/lib/patterns/native-parser'
import { getR2Client } from '#/lib/r2/client'

type NativeRowInput = {
  id?: unknown
  blockType?: unknown
  rowType?: unknown
  instruction?: unknown
  colorKey?: unknown
  imageR2Key?: unknown
  imageMimeType?: unknown
  imageByteSize?: unknown
  imageAltText?: unknown
  imageCaption?: unknown
  blockHeading?: unknown
  designStyle?: unknown
}

type NativeSectionInput = {
  id?: unknown
  sectionType?: unknown
  title?: unknown
  notes?: unknown
  rows?: unknown
  designStyle?: unknown
}

export const Route = createFileRoute('/api/patterns/$patternId/native')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const visiblePattern = await getVisibleNativePattern(request, params.patternId)
        if (visiblePattern.response) return visiblePattern.response
        const [sections, rows, colors] = await Promise.all([
          getDb().select().from(nativePatternSections).where(eq(nativePatternSections.patternId, params.patternId)).orderBy(asc(nativePatternSections.sortOrder)),
          getDb().select().from(nativePatternRows).where(eq(nativePatternRows.patternId, params.patternId)).orderBy(asc(nativePatternRows.sortOrder)),
          getDb().select().from(nativePatternColors).where(eq(nativePatternColors.patternId, params.patternId)).orderBy(asc(nativePatternColors.sortOrder)),
        ])
        const normalizedSections = sections.map((section) => ({
          ...section,
          sectionType: normalizeNativeSectionType(section.sectionType),
          designStyle: normalizeNativeBlockStyle(parseJson(section.designStyleJson)),
          rows: rows.filter((row) => row.sectionId === section.id).map((row) => ({
            ...row,
            designStyle: normalizeNativeBlockStyle(parseJson(row.designStyleJson)),
            imageR2Key: visiblePattern.pattern.userId === visiblePattern.userId ? row.imageR2Key : undefined,
            imageSrc: row.blockType === 'image' && row.imageR2Key ? `/api/patterns/${params.patternId}/native-images?blockId=${row.id}` : null,
          })),
        }))
        const rawStyle = parseJson(visiblePattern.pattern.nativeStyleJson)
        const style = normalizeNativePatternStyle(rawStyle)
        if (!(rawStyle && typeof rawStyle === 'object' && typeof (rawStyle as Record<string, unknown>).isFinalized === 'boolean')) {
          style.isFinalized = visiblePattern.pattern.isPublic
        }
        style.gridLayout = reconcileNativeGridLayout(style.gridLayout, normalizedSections, colors.length > 0)
        return Response.json({
          pattern: {
            id: visiblePattern.pattern.id,
            title: visiblePattern.pattern.title,
            description: visiblePattern.pattern.description,
            difficulty: visiblePattern.pattern.difficulty,
            coverSrc: visiblePattern.pattern.coverR2Key ? `/api/patterns/${params.patternId}/cover` : null,
            canEdit: visiblePattern.pattern.userId === visiblePattern.userId,
            isFinalized: style.isFinalized,
            style,
          },
          colors,
          sections: normalizedSections,
        })
      },
      PUT: async ({ request, params }) => {
        const ownedPattern = await getOwnedNativePattern(request, params.patternId)
        if (ownedPattern.response) return ownedPattern.response
        let body: Record<string, unknown>
        try {
          body = await request.json() as Record<string, unknown>
        } catch {
          return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
        }

        const title = cleanRequiredText(body.title, 200)
        const description = cleanOptionalText(body.description, 5_000)
        const difficulty = cleanOptionalText(body.difficulty, 100)
        const style = normalizeNativePatternStyle(body.style)
        if (!title || description === undefined || difficulty === undefined) {
          return Response.json({ message: 'Pattern metadata is invalid.' }, { status: 400 })
        }
        if (!Array.isArray(body.sections) || !body.sections.length || !Array.isArray(body.colors)) {
          return Response.json({ message: 'At least one section and a colors array are required.' }, { status: 400 })
        }

        const colors = body.colors.slice(0, 20).map((raw, index) => {
          const item = raw as Record<string, unknown>
          return {
            id: cleanId(item.id),
            patternId: params.patternId,
            key: cleanColorKey(item.key),
            label: cleanRequiredText(item.label, 100),
            hexColor: normalizeHex(item.hexColor),
            sortOrder: index,
          }
        })
        if (colors.some((color) => !color.key || !color.label) || new Set(colors.map((color) => color.key)).size !== colors.length) {
          return Response.json({ message: 'Color keys must be unique and use letters or numbers.' }, { status: 400 })
        }
        const validColors = colors.map((color) => ({ ...color, key: color.key as string, label: color.label as string }))

        let nextRowNumber = 1
        const sections = body.sections.slice(0, 50).map((raw, sectionIndex) => {
          const item = raw as NativeSectionInput
          const sectionId = cleanId(item.id)
          const sectionRows = Array.isArray(item.rows) ? item.rows.slice(0, 500) as NativeRowInput[] : []
          let previousStitchCount: number | null = null
          const rows = sectionRows.map((row, rowIndex) => {
            const blockType = row.blockType === 'image' ? 'image' : row.blockType === 'note' ? 'note' : row.blockType === 'text' ? 'text' : 'row'
            const instruction = cleanOptionalText(row.instruction, blockType === 'note' || blockType === 'text' ? 10_000 : 2_000) ?? ''
            const rowType: PatternStepType = row.rowType === 'chain' ? 'chain' : row.rowType === 'magic-ring' ? 'magic-ring' : row.rowType === 'row' ? 'row' : 'round'
            const parsed = blockType === 'row' ? parsePatternStep(rowType, instruction, previousStitchCount) : null
            if (parsed) previousStitchCount = parsed.stitchCount
            const imageR2Key = blockType === 'image' && typeof row.imageR2Key === 'string' && row.imageR2Key.startsWith(`users/${ownedPattern.userId}/patterns/${params.patternId}/native/`)
              ? row.imageR2Key
              : null
            return {
              id: cleanId(row.id),
              patternId: params.patternId,
              sectionId,
              blockType,
              rowType,
              rowNumber: blockType !== 'row' || rowType === 'chain' || rowType === 'magic-ring' ? 0 : nextRowNumber++,
              instruction,
              structuredJson: parsed ? JSON.stringify(parsed) : null,
              computedStitchCount: parsed?.stitchCount ?? null,
              colorKey: blockType === 'row' && typeof row.colorKey === 'string' && row.colorKey.trim() ? row.colorKey.trim().toUpperCase() : null,
              imageR2Key,
              imageMimeType: imageR2Key ? cleanOptionalText(row.imageMimeType, 100) ?? 'image/jpeg' : null,
              imageByteSize: imageR2Key && typeof row.imageByteSize === 'number' && Number.isSafeInteger(row.imageByteSize) ? row.imageByteSize : null,
              imageAltText: imageR2Key ? cleanOptionalText(row.imageAltText, 500) ?? null : null,
              imageCaption: imageR2Key ? cleanOptionalText(row.imageCaption, 1_000) ?? null : null,
              blockHeading: blockType === 'text' ? cleanOptionalText(row.blockHeading, 300) ?? null : null,
              designStyleJson: JSON.stringify(normalizeNativeBlockStyle(row.designStyle)),
              sortOrder: sectionIndex * 1_000 + rowIndex,
            }
          })
          return {
            id: sectionId,
            patternId: params.patternId,
            sectionType: normalizeNativeSectionType(item.sectionType),
            title: cleanRequiredText(item.title, 200) ?? `Section ${sectionIndex + 1}`,
            notes: cleanOptionalText(item.notes, 5_000) ?? null,
            designStyleJson: JSON.stringify(normalizeNativeBlockStyle(item.designStyle)),
            sortOrder: sectionIndex,
            rows,
          }
        })
        style.gridLayout = reconcileNativeGridLayout(style.gridLayout, sections, validColors.length > 0)
        const previousImageKeys = await getDb()
          .select({ key: nativePatternRows.imageR2Key })
          .from(nativePatternRows)
          .where(and(eq(nativePatternRows.patternId, params.patternId), eq(nativePatternRows.blockType, 'image')))
        const retainedImageKeys = new Set(sections.flatMap((section) => section.rows.map((row) => row.imageR2Key).filter((key): key is string => Boolean(key))))

        await getDb().transaction(async (tx) => {
          await tx.update(patterns).set({ title, description, difficulty, nativeStyleJson: JSON.stringify(style), updatedAt: Date.now() }).where(and(eq(patterns.id, params.patternId), eq(patterns.userId, ownedPattern.userId)))
          await tx.delete(nativePatternRows).where(eq(nativePatternRows.patternId, params.patternId))
          await tx.delete(nativePatternSections).where(eq(nativePatternSections.patternId, params.patternId))
          await tx.delete(nativePatternColors).where(eq(nativePatternColors.patternId, params.patternId))
          if (validColors.length) await tx.insert(nativePatternColors).values(validColors)
          await tx.insert(nativePatternSections).values(sections.map(({ rows: _rows, ...section }) => section))
          const rows = sections.flatMap((section) => section.rows)
          if (rows.length) await tx.insert(nativePatternRows).values(rows)
        })
        await Promise.allSettled(previousImageKeys
          .map((row) => row.key)
          .filter((key): key is string => Boolean(key))
          .filter((key) => !retainedImageKeys.has(key))
          .map((key) => getR2Client().send(new DeleteObjectCommand({ Bucket: getServerEnv().R2_BUCKET, Key: key }))))

        return Response.json({ message: 'Pattern saved.' })
      },
      PATCH: async ({ request, params }) => {
        const ownedPattern = await getOwnedNativePattern(request, params.patternId)
        if (ownedPattern.response) return ownedPattern.response
        const body = await request.json().catch(() => null) as Record<string, unknown> | null
        if (!body) return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
        const style = typeof body.style === 'undefined'
          ? normalizeNativePatternStyle(parseJson(ownedPattern.pattern.nativeStyleJson))
          : normalizeNativePatternStyle(body.style)
        const isFinalized = typeof body.isFinalized === 'boolean' ? body.isFinalized : style.isFinalized
        style.isFinalized = isFinalized
        await getDb().update(patterns).set({
          nativeStyleJson: JSON.stringify(style),
          updatedAt: Date.now(),
        }).where(and(eq(patterns.id, params.patternId), eq(patterns.userId, ownedPattern.userId)))
        return Response.json({ message: isFinalized ? 'Private pattern finalized.' : 'Pattern reopened for editing.', isFinalized, style })
      },
    },
  },
})

async function getOwnedNativePattern(request: Request, patternId: string): Promise<
  { userId: string; pattern: typeof patterns.$inferSelect; response?: undefined } |
  { userId: ''; pattern?: undefined; response: Response }
> {
  const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
  if (!authUser) return { userId: '', response: Response.json({ message: 'Unauthorized' }, { status: 401 }) }
  const pattern = await getDb().query.patterns.findFirst({ where: and(eq(patterns.id, patternId), eq(patterns.userId, authUser.id)) })
  if (!pattern || pattern.patternType !== 'native') return { userId: '', response: Response.json({ message: 'Native pattern not found.' }, { status: 404 }) }
  return { userId: authUser.id, pattern }
}

async function getVisibleNativePattern(request: Request, patternId: string): Promise<
  { userId: string; pattern: typeof patterns.$inferSelect; response?: undefined } |
  { userId: ''; pattern?: undefined; response: Response }
> {
  const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
  if (!authUser) return { userId: '', response: Response.json({ message: 'Unauthorized' }, { status: 401 }) }
  const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, patternId) })
  if (!pattern || pattern.patternType !== 'native' || pattern.moderationStatus !== 'active' || (pattern.userId !== authUser.id && !pattern.isPublic)) {
    return { userId: '', response: Response.json({ message: 'Native pattern not found.' }, { status: 404 }) }
  }
  return { userId: authUser.id, pattern }
}

function parseJson(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function cleanId(value: unknown) {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(value) ? value : crypto.randomUUID()
}

function cleanRequiredText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  return cleaned && cleaned.length <= maxLength ? cleaned : null
}

function cleanOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim()
  return cleaned.length <= maxLength ? cleaned || null : undefined
}

function cleanColorKey(value: unknown) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().toUpperCase()
  return /^[A-Z][A-Z0-9]{0,7}$/.test(cleaned) ? cleaned : null
}

function normalizeHex(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const cleaned = value.trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(cleaned) ? cleaned : null
}
