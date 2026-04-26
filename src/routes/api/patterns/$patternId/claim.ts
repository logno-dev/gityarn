import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { communityFlags, patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId/claim')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, params.patternId) })
        if (!pattern || !pattern.isPublic) {
          return Response.json({ message: 'Public pattern not found.' }, { status: 404 })
        }

        const body = (await request.json()) as { details?: string }
        const details = body.details?.trim() || null

        const duplicate = await getDb().query.communityFlags.findFirst({
          where: and(
            eq(communityFlags.entityType, 'pattern_publication'),
            eq(communityFlags.entityId, params.patternId),
            eq(communityFlags.reason, 'copyright_claim'),
            eq(communityFlags.createdByUserId, authUser.id),
            eq(communityFlags.status, 'open'),
          ),
        })

        if (duplicate) {
          return Response.json({ message: 'You already filed a claim for this pattern.' }, { status: 200 })
        }

        await getDb().insert(communityFlags).values({
          id: crypto.randomUUID(),
          entityType: 'pattern_publication',
          entityId: params.patternId,
          reason: 'copyright_claim',
          details,
          status: 'open',
          createdByUserId: authUser.id,
        })

        return Response.json({ message: 'Claim filed. Admins will review this report.' }, { status: 201 })
      },
    },
  },
})
