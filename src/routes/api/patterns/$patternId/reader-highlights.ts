import { and, asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { patternPdfHighlights, patterns } from '#/lib/db/schema'
import { normalizePatternLanguage } from '#/lib/patterns/languages'

const highlightColors = ['yellow', 'pink', 'mint'] as const

export const Route = createFileRoute('/api/patterns/$patternId/reader-highlights')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const access = await getPatternAccess(request, params.patternId)
        if (access.response) return access.response
        const languageCode = normalizePatternLanguage(new URL(request.url).searchParams.get('lang')).code
        const highlights = await getDb().select({
          id: patternPdfHighlights.id,
          pageNumber: patternPdfHighlights.pageNumber,
          x: patternPdfHighlights.x,
          y: patternPdfHighlights.y,
          width: patternPdfHighlights.width,
          height: patternPdfHighlights.height,
          color: patternPdfHighlights.color,
          note: patternPdfHighlights.note,
        }).from(patternPdfHighlights).where(and(
          eq(patternPdfHighlights.userId, access.userId),
          eq(patternPdfHighlights.patternId, params.patternId),
          eq(patternPdfHighlights.languageCode, languageCode),
        )).orderBy(asc(patternPdfHighlights.pageNumber), asc(patternPdfHighlights.createdAt))
        return Response.json({ highlights })
      },
      POST: async ({ request, params }) => {
        const access = await getPatternAccess(request, params.patternId)
        if (access.response) return access.response
        const body = await readBody(request)
        if (!body) return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
        const geometry = normalizeGeometry(body)
        const pageNumber = positiveInteger(body.pageNumber)
        const color = highlightColors.includes(body.color as typeof highlightColors[number]) ? body.color as typeof highlightColors[number] : 'yellow'
        if (!pageNumber || !geometry) return Response.json({ message: 'Valid page and highlight coordinates are required.' }, { status: 400 })
        const highlight = {
          id: crypto.randomUUID(),
          userId: access.userId,
          patternId: params.patternId,
          languageCode: normalizePatternLanguage(typeof body.languageCode === 'string' ? body.languageCode : null).code,
          pageNumber,
          ...geometry,
          color,
          note: null,
        }
        await getDb().insert(patternPdfHighlights).values(highlight)
        return Response.json({ highlight }, { status: 201 })
      },
      PATCH: async ({ request, params }) => {
        const access = await getPatternAccess(request, params.patternId)
        if (access.response) return access.response
        const body = await readBody(request)
        const id = typeof body?.id === 'string' ? body.id : ''
        const note = optionalText(body?.note, 2_000)
        if (!id || note === undefined) return Response.json({ message: 'Valid highlight id and note are required.' }, { status: 400 })
        await getDb().update(patternPdfHighlights).set({ note, updatedAt: Date.now() }).where(and(
          eq(patternPdfHighlights.id, id),
          eq(patternPdfHighlights.userId, access.userId),
          eq(patternPdfHighlights.patternId, params.patternId),
        ))
        return Response.json({ id, note })
      },
      DELETE: async ({ request, params }) => {
        const access = await getPatternAccess(request, params.patternId)
        if (access.response) return access.response
        const id = new URL(request.url).searchParams.get('id')?.trim()
        if (!id) return Response.json({ message: 'Highlight id is required.' }, { status: 400 })
        await getDb().delete(patternPdfHighlights).where(and(
          eq(patternPdfHighlights.id, id),
          eq(patternPdfHighlights.userId, access.userId),
          eq(patternPdfHighlights.patternId, params.patternId),
        ))
        return Response.json({ id })
      },
    },
  },
})

async function getPatternAccess(request: Request, patternId: string): Promise<{ userId: string; response?: undefined } | { userId: ''; response: Response }> {
  const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
  if (!authUser) return { userId: '', response: Response.json({ message: 'Unauthorized' }, { status: 401 }) }
  const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, patternId) })
  if (!pattern) return { userId: '', response: Response.json({ message: 'Pattern not found.' }, { status: 404 }) }
  if (!pattern.isPublic && pattern.userId !== authUser.id) return { userId: '', response: Response.json({ message: 'Forbidden' }, { status: 403 }) }
  return { userId: authUser.id }
}

async function readBody(request: Request) {
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return null
  }
}

function positiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null
}

function normalizeGeometry(body: Record<string, unknown>) {
  const values = [body.x, body.y, body.width, body.height]
  if (!values.every((value) => typeof value === 'number' && Number.isInteger(value))) return null
  const [x, y, width, height] = values as number[]
  if (x < 0 || y < 0 || width < 20 || height < 20 || x + width > 10_000 || y + height > 10_000) return null
  return { x, y, width, height }
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim()
  return cleaned.length <= maxLength ? cleaned || null : undefined
}
