import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { patternLibraryLinks, patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId/library')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, params.patternId) })
        if (!pattern) return Response.json({ message: 'Pattern not found.' }, { status: 404 })
        if (!pattern.isPublic && pattern.userId !== authUser.id) return Response.json({ message: 'Forbidden' }, { status: 403 })

        const existing = await getDb().query.patternLibraryLinks.findFirst({ where: and(eq(patternLibraryLinks.patternId, pattern.id), eq(patternLibraryLinks.userId, authUser.id)) })
        if (existing) return Response.json({ message: 'Already in your library.' }, { status: 200 })

        await getDb().insert(patternLibraryLinks).values({ patternId: pattern.id, userId: authUser.id, createdAt: Date.now() })
        return Response.json({ message: 'Pattern added to your inventory library.' }, { status: 201 })
      },
      DELETE: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        await getDb().delete(patternLibraryLinks).where(and(eq(patternLibraryLinks.patternId, params.patternId), eq(patternLibraryLinks.userId, authUser.id)))
        return Response.json({ message: 'Pattern removed from your library.' }, { status: 200 })
      },
    },
  },
})
