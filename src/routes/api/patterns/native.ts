import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { nativePatternColors, nativePatternRows, nativePatternSections, patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/native')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        let body: Record<string, unknown>
        try {
          body = await request.json() as Record<string, unknown>
        } catch {
          return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
        }
        const title = typeof body.title === 'string' ? body.title.trim() : ''
        if (!title || title.length > 200) return Response.json({ message: 'A title up to 200 characters is required.' }, { status: 400 })

        const patternId = crypto.randomUUID()
        const sectionId = crypto.randomUUID()
        await getDb().transaction(async (tx) => {
          await tx.insert(patterns).values({
            id: patternId,
            userId: authUser.id,
            title,
            patternType: 'native',
            isPublic: false,
            publicShareConfirmed: false,
          })
          await tx.insert(nativePatternSections).values({ id: sectionId, patternId, title: 'Pattern', sortOrder: 0 })
          await tx.insert(nativePatternRows).values({ id: crypto.randomUUID(), patternId, sectionId, rowType: 'chain', rowNumber: 0, instruction: '', sortOrder: 0 })
          await tx.insert(nativePatternColors).values({ id: crypto.randomUUID(), patternId, key: 'MC', label: 'Main Color', sortOrder: 0 })
        })

        return Response.json({ message: 'Native pattern created.', patternId, nextPath: `/pattern/${patternId}/edit` }, { status: 201 })
      },
    },
  },
})
