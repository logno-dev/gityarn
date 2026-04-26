import { eq, inArray } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { manufacturers, yarnColorways, yarnLines } from '#/lib/db/schema'

export const Route = createFileRoute('/api/scan/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const url = new URL(request.url)
        const rawQuery = (url.searchParams.get('query') ?? '').trim().toLowerCase()
        if (!rawQuery) {
          return Response.json({ lines: [] }, { status: 200 })
        }

        const tokens = tokenize(rawQuery)
        if (!tokens.length) {
          return Response.json({ lines: [] }, { status: 200 })
        }

        const candidateLines = await db
          .select({
            id: yarnLines.id,
            name: yarnLines.name,
            manufacturerName: manufacturers.name,
          })
          .from(yarnLines)
          .innerJoin(manufacturers, eq(yarnLines.manufacturerId, manufacturers.id))
          .limit(350)

        const lineIds = candidateLines.map((line) => line.id)
        const colorways = lineIds.length
          ? await db
              .select({
                id: yarnColorways.id,
                yarnLineId: yarnColorways.yarnLineId,
                name: yarnColorways.name,
                colorCode: yarnColorways.colorCode,
              })
              .from(yarnColorways)
              .where(inArray(yarnColorways.yarnLineId, lineIds))
              .limit(5000)
          : []

        const colorsByLine = new Map<string, Array<{ id: string; name: string; colorCode: string | null }>>()
        for (const color of colorways) {
          const list = colorsByLine.get(color.yarnLineId) ?? []
          list.push({ id: color.id, name: color.name, colorCode: color.colorCode })
          colorsByLine.set(color.yarnLineId, list)
        }

        const scored = candidateLines
          .map((line) => {
            const colors = colorsByLine.get(line.id) ?? []
            const lineHaystack = `${line.manufacturerName} ${line.name}`.toLowerCase()
            const lineTokenMatches = tokens.filter((token) => hasWordToken(lineHaystack, token))
            const unmatchedLineTokens = tokens.filter((token) => !lineTokenMatches.includes(token))

            const requiredLineTokenMatches = tokens.length >= 3 ? 2 : 1
            if (lineTokenMatches.length < requiredLineTokenMatches) {
              return null
            }

            const scoredColors = colors
              .map((color) => {
                const colorText = `${color.name} ${color.colorCode ?? ''}`.toLowerCase()
                const matchedUnmatchedTokens = unmatchedLineTokens.filter((token) => hasWordToken(colorText, token))
                const matchedAllUnmatched = unmatchedLineTokens.length > 0 && matchedUnmatchedTokens.length === unmatchedLineTokens.length
                const matchedAnyQueryToken = tokens.some((token) => hasWordToken(colorText, token))
                const score = matchedUnmatchedTokens.length * 6 + (matchedAllUnmatched ? 6 : 0) + (matchedAnyQueryToken ? 1 : 0)

                return {
                  color,
                  matchedUnmatchedTokens,
                  matchedAllUnmatched,
                  matchedAnyQueryToken,
                  score,
                }
              })
              .sort((a, b) => b.score - a.score)

            const strictColors = scoredColors.filter((item) => item.matchedAllUnmatched)
            const fallbackColors = scoredColors.filter((item) => item.matchedUnmatchedTokens.length > 0)
            const bestColorMatchCount = fallbackColors[0]?.matchedUnmatchedTokens.length ?? 0
            const defaultColors = [...colors].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8)

            if (unmatchedLineTokens.length > 0 && strictColors.length === 0) {
              const lineStartsWithQuery = lineHaystack.startsWith(rawQuery)
              const lineContainsQuery = lineHaystack.includes(rawQuery)
              if (!lineStartsWithQuery && !lineContainsQuery && bestColorMatchCount === 0) {
                return null
              }
            }

            if (unmatchedLineTokens.length >= 2 && strictColors.length === 0 && bestColorMatchCount < unmatchedLineTokens.length - 1) {
              return null
            }

            const limitedColors =
              unmatchedLineTokens.length === 0
                ? defaultColors
                : strictColors.length > 0
                ? strictColors.slice(0, 6).map((item) => item.color)
                : fallbackColors.length > 0
                  ? fallbackColors.slice(0, 3).map((item) => item.color)
                  : []

            let score = 0
            score += lineTokenMatches.length * 5
            score += strictColors.length > 0 ? 10 : 0
            score += bestColorMatchCount * 5
            if (lineHaystack.startsWith(rawQuery)) {
              score += 6
            } else if (lineHaystack.includes(rawQuery)) {
              score += 3
            }
            if (line.name.toLowerCase() === rawQuery) {
              score += 8
            }

            return {
              line,
              colors: limitedColors,
              score,
            }
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)

        return Response.json(
          {
            lines: scored.map((item) => ({
              id: item.line.id,
              name: item.line.name,
              manufacturerName: item.line.manufacturerName,
              colorways: item.colors,
            })),
          },
          { status: 200 },
        )
      },
    },
  },
})

function tokenize(input: string) {
  return [...new Set(input.split(/[^a-z0-9]+/g).map((token) => token.trim()).filter((token) => token.length > 1))]
}

function hasWordToken(haystack: string, token: string) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(^|[^a-z0-9])${escaped}[a-z0-9]*([^a-z0-9]|$)`, 'i')
  return regex.test(haystack)
}
