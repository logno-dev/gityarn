import { asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { normalizePatternLanguage } from '#/lib/patterns/languages'
import { patternFileVariants, patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId/variants')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, params.patternId) })
        if (!pattern) return Response.json({ message: 'Pattern not found.' }, { status: 404 })
        if (!pattern.isPublic && pattern.userId !== authUser.id) return Response.json({ message: 'Forbidden' }, { status: 403 })

        const rows = await getDb()
          .select({
            id: patternFileVariants.id,
            languageCode: patternFileVariants.languageCode,
            languageLabel: patternFileVariants.languageLabel,
            fileName: patternFileVariants.fileName,
          })
          .from(patternFileVariants)
          .where(eq(patternFileVariants.patternId, pattern.id))
          .orderBy(asc(patternFileVariants.languageCode))

        if (!rows.length && pattern.pdfR2Key) {
          const fallbackLang = normalizePatternLanguage('en-US')
          return Response.json(
            {
              variants: [
                {
                  id: `legacy:${pattern.id}`,
                  languageCode: fallbackLang.code,
                  languageLabel: `${fallbackLang.label} (legacy)`,
                  fileName: pattern.pdfFileName,
                },
              ],
            },
            { status: 200 },
          )
        }

        return Response.json({ variants: rows }, { status: 200 })
      },
    },
  },
})
