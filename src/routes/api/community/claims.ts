import { and, desc, eq, inArray } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { communityClaims, communityClaimVotes, users } from '#/lib/db/schema'
import { sendAdminModerationAlert } from '#/lib/notifications/admin-moderation'

export const Route = createFileRoute('/api/community/claims')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const url = new URL(request.url)
        const entityType = url.searchParams.get('entityType')
        const entityId = url.searchParams.get('entityId')
        const fieldKey = url.searchParams.get('fieldKey')

        const predicates = []
        if (entityType) {
          predicates.push(eq(communityClaims.entityType, entityType))
        }
        if (entityId) {
          predicates.push(eq(communityClaims.entityId, entityId))
        }
        if (fieldKey) {
          predicates.push(eq(communityClaims.fieldKey, fieldKey))
        }

        const where = predicates.length ? and(...predicates) : undefined

        const claims = await db
          .select({
            id: communityClaims.id,
            entityType: communityClaims.entityType,
            entityId: communityClaims.entityId,
            fieldKey: communityClaims.fieldKey,
            proposedValue: communityClaims.proposedValue,
            notes: communityClaims.notes,
            status: communityClaims.status,
            createdAt: communityClaims.createdAt,
            createdByUserId: communityClaims.createdByUserId,
            createdByName: users.displayName,
          })
          .from(communityClaims)
          .innerJoin(users, eq(communityClaims.createdByUserId, users.id))
          .where(where)
          .orderBy(desc(communityClaims.createdAt))
          .limit(120)

        const claimIds = claims.map((claim) => claim.id)
        const votes = claimIds.length
          ? await db
              .select({
                claimId: communityClaimVotes.claimId,
                userId: communityClaimVotes.userId,
                vote: communityClaimVotes.vote,
              })
              .from(communityClaimVotes)
              .where(inArray(communityClaimVotes.claimId, claimIds))
          : []

        const byClaim = new Map<string, Array<{ userId: string; vote: string }>>()
        for (const vote of votes) {
          const list = byClaim.get(vote.claimId) ?? []
          list.push({ userId: vote.userId, vote: vote.vote })
          byClaim.set(vote.claimId, list)
        }

        return Response.json(
          {
            claims: claims.map((claim) => {
              const claimVotes = byClaim.get(claim.id) ?? []
              const agreeCount = claimVotes.filter((vote) => vote.vote === 'agree').length
              const disagreeCount = claimVotes.filter((vote) => vote.vote === 'disagree').length
              const userVote = claimVotes.find((vote) => vote.userId === authUser.id)?.vote ?? null

              return {
                ...claim,
                agreeCount,
                disagreeCount,
                userVote,
              }
            }),
          },
          { status: 200 },
        )
      },
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as {
          entityType?: string
          entityId?: string
          fieldKey?: string
          proposedValue?: string
          notes?: string
        }

        if (!body.entityType || !body.entityId) {
          return Response.json({ message: 'entityType and entityId are required.' }, { status: 400 })
        }

        if (body.fieldKey && !body.proposedValue) {
          return Response.json({ message: 'proposedValue is required when fieldKey is provided.' }, { status: 400 })
        }

        const db = getDb()
        await db.insert(communityClaims).values({
          id: crypto.randomUUID(),
          entityType: body.entityType,
          entityId: body.entityId,
          fieldKey: body.fieldKey ?? null,
          proposedValue: body.proposedValue ?? null,
          notes: body.notes ?? null,
          createdByUserId: authUser.id,
        })

        try {
          await sendAdminModerationAlert({
            kind: 'correction',
            actor: {
              id: authUser.id,
              displayName: authUser.displayName,
              email: authUser.email,
            },
            entity: {
              type: body.entityType,
              id: body.entityId,
            },
            reason: body.fieldKey ?? null,
            details: body.notes ?? body.proposedValue ?? null,
          })
        } catch (error) {
          console.error('Failed sending correction alert email', error)
        }

        return Response.json({ message: 'Correction submitted.' }, { status: 201 })
      },
    },
  },
})
