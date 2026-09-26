import { and, asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { patternPageMetadata, patternReaderStates, patterns } from '#/lib/db/schema'
import { normalizePatternLanguage } from '#/lib/patterns/languages'

export const Route = createFileRoute('/api/patterns/$patternId/reader-metadata')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const access = await getPatternAccess(request, params.patternId)
        if (access.response) return access.response

        const languageCode = normalizePatternLanguage(new URL(request.url).searchParams.get('lang')).code
        const stateWhere = and(
          eq(patternReaderStates.userId, access.userId),
          eq(patternReaderStates.patternId, params.patternId),
          eq(patternReaderStates.languageCode, languageCode),
        )
        const pageWhere = and(
          eq(patternPageMetadata.userId, access.userId),
          eq(patternPageMetadata.patternId, params.patternId),
          eq(patternPageMetadata.languageCode, languageCode),
        )
        const [state, pages] = await Promise.all([
          getDb().query.patternReaderStates.findFirst({ where: stateWhere }),
          getDb().select({
            pageNumber: patternPageMetadata.pageNumber,
            isBookmarked: patternPageMetadata.isBookmarked,
            bookmarkLabel: patternPageMetadata.bookmarkLabel,
            note: patternPageMetadata.note,
          }).from(patternPageMetadata).where(pageWhere).orderBy(asc(patternPageMetadata.pageNumber)),
        ])

        return Response.json({
          languageCode,
          lastReadPage: state?.lastReadPage ?? 1,
          pageCount: state?.pageCount ?? null,
          progress: state?.pageCount ? state.lastReadPage / state.pageCount : null,
          pages,
        })
      },
      PATCH: async ({ request, params }) => {
        const access = await getPatternAccess(request, params.patternId)
        if (access.response) return access.response

        let body: Record<string, unknown>
        try {
          body = await request.json() as Record<string, unknown>
        } catch {
          return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
        }

        const languageCode = normalizePatternLanguage(typeof body.languageCode === 'string' ? body.languageCode : null).code
        if (body.kind === 'progress') {
          const lastReadPage = positiveInteger(body.lastReadPage)
          const pageCount = positiveInteger(body.pageCount)
          if (!lastReadPage || !pageCount || lastReadPage > pageCount) {
            return Response.json({ message: 'Valid lastReadPage and pageCount are required.' }, { status: 400 })
          }
          await getDb().insert(patternReaderStates).values({
            userId: access.userId,
            patternId: params.patternId,
            languageCode,
            lastReadPage,
            pageCount,
          }).onConflictDoUpdate({
            target: [patternReaderStates.userId, patternReaderStates.patternId, patternReaderStates.languageCode],
            set: { lastReadPage, pageCount, updatedAt: Date.now() },
          })
          return Response.json({ lastReadPage, pageCount, progress: lastReadPage / pageCount })
        }

        if (body.kind === 'page') {
          const pageNumber = positiveInteger(body.pageNumber)
          if (!pageNumber) return Response.json({ message: 'A valid pageNumber is required.' }, { status: 400 })
          const isBookmarked = body.isBookmarked === true
          const bookmarkLabel = optionalText(body.bookmarkLabel, 200)
          const note = optionalText(body.note, 10_000)
          if (bookmarkLabel === undefined || note === undefined) {
            return Response.json({ message: 'Bookmark labels may be 200 characters and notes 10,000 characters.' }, { status: 400 })
          }
          const pageWhere = and(
            eq(patternPageMetadata.userId, access.userId),
            eq(patternPageMetadata.patternId, params.patternId),
            eq(patternPageMetadata.languageCode, languageCode),
            eq(patternPageMetadata.pageNumber, pageNumber),
          )
          if (!isBookmarked && !bookmarkLabel && !note) {
            await getDb().delete(patternPageMetadata).where(pageWhere)
          } else {
            await getDb().insert(patternPageMetadata).values({
              userId: access.userId,
              patternId: params.patternId,
              languageCode,
              pageNumber,
              isBookmarked,
              bookmarkLabel,
              note,
            }).onConflictDoUpdate({
              target: [patternPageMetadata.userId, patternPageMetadata.patternId, patternPageMetadata.languageCode, patternPageMetadata.pageNumber],
              set: { isBookmarked, bookmarkLabel, note, updatedAt: Date.now() },
            })
          }
          return Response.json({ page: { pageNumber, isBookmarked, bookmarkLabel, note } })
        }

        return Response.json({ message: 'kind must be progress or page.' }, { status: 400 })
      },
    },
  },
})

async function getPatternAccess(request: Request, patternId: string): Promise<{ userId: string; response?: undefined } | { userId: ''; response: Response }> {
  const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
  if (!authUser) return { userId: '', response: Response.json({ message: 'Unauthorized' }, { status: 401 }) }
  const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, patternId) })
  if (!pattern) return { userId: '', response: Response.json({ message: 'Pattern not found.' }, { status: 404 }) }
  if (!pattern.isPublic && pattern.userId !== authUser.id) {
    return { userId: '', response: Response.json({ message: 'Forbidden' }, { status: 403 }) }
  }
  return { userId: authUser.id }
}

function positiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim()
  if (cleaned.length > maxLength) return undefined
  return cleaned || null
}
