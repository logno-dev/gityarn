import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { communityClaims, communityClaimVotes, yarnColorways, yarnLines } from '#/lib/db/schema'

export const Route = createFileRoute('/api/community/claims/$claimId/vote')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as { vote?: 'agree' | 'disagree' }
        if (body.vote !== 'agree' && body.vote !== 'disagree') {
          return Response.json({ message: 'vote must be agree or disagree.' }, { status: 400 })
        }

        const db = getDb()
        const claim = await db.query.communityClaims.findFirst({ where: eq(communityClaims.id, params.claimId) })
        if (!claim) {
          return Response.json({ message: 'Claim not found.' }, { status: 404 })
        }

        await db
          .insert(communityClaimVotes)
          .values({
            claimId: claim.id,
            userId: authUser.id,
            vote: body.vote,
          })
          .onConflictDoUpdate({
            target: [communityClaimVotes.claimId, communityClaimVotes.userId],
            set: {
              vote: body.vote,
              updatedAt: Date.now(),
            },
          })

        const votes = await db.query.communityClaimVotes.findMany({ where: eq(communityClaimVotes.claimId, claim.id) })
        const agreeCount = votes.filter((vote) => vote.vote === 'agree').length
        const disagreeCount = votes.filter((vote) => vote.vote === 'disagree').length

        if (claim.status === 'open' && agreeCount >= 3 && agreeCount > disagreeCount) {
          await applyAcceptedClaim(claim)
          await db
            .update(communityClaims)
            .set({
              status: 'accepted',
              resolvedAt: Date.now(),
              resolvedByUserId: authUser.id,
              updatedAt: Date.now(),
            })
            .where(eq(communityClaims.id, claim.id))
        } else if (claim.status === 'open' && disagreeCount >= 3 && disagreeCount > agreeCount) {
          await db
            .update(communityClaims)
            .set({
              status: 'rejected',
              resolvedAt: Date.now(),
              resolvedByUserId: authUser.id,
              updatedAt: Date.now(),
            })
            .where(eq(communityClaims.id, claim.id))
        }

        return Response.json({ message: 'Vote saved.', agreeCount, disagreeCount }, { status: 200 })
      },
    },
  },
})

async function applyAcceptedClaim(claim: typeof communityClaims.$inferSelect) {
  const db = getDb()
  if (!claim.fieldKey || !claim.proposedValue) {
    return
  }

  if (claim.entityType === 'yarn_line') {
    const line = await db.query.yarnLines.findFirst({ where: eq(yarnLines.id, claim.entityId) })
    if (!line) {
      return
    }

    if (claim.fieldKey === 'name') {
      await db.update(yarnLines).set({ name: claim.proposedValue, updatedAt: Date.now() }).where(eq(yarnLines.id, line.id))
      return
    }

    if (claim.fieldKey === 'weightClass') {
      await db
        .update(yarnLines)
        .set({ weightClass: claim.proposedValue, updatedAt: Date.now() })
        .where(eq(yarnLines.id, line.id))
      return
    }

    if (claim.fieldKey === 'fiberContent') {
      await db
        .update(yarnLines)
        .set({ fiberContent: claim.proposedValue, updatedAt: Date.now() })
        .where(eq(yarnLines.id, line.id))
      return
    }

    if (claim.fieldKey === 'yardageMeters') {
      const parsed = Number(claim.proposedValue)
      if (!Number.isFinite(parsed)) {
        return
      }
      await db
        .update(yarnLines)
        .set({ yardageMeters: Math.round(parsed), updatedAt: Date.now() })
        .where(eq(yarnLines.id, line.id))
      return
    }

    if (claim.fieldKey === 'needleOrHookRange') {
      await db
        .update(yarnLines)
        .set({ needleOrHookRange: claim.proposedValue, updatedAt: Date.now() })
        .where(eq(yarnLines.id, line.id))
      return
    }

    if (claim.fieldKey === 'productUrl') {
      await db
        .update(yarnLines)
        .set({ productUrl: claim.proposedValue, updatedAt: Date.now() })
        .where(eq(yarnLines.id, line.id))
      return
    }

    if (claim.fieldKey === 'needleOrHookRange') {
      await db
        .update(yarnLines)
        .set({ needleOrHookRange: claim.proposedValue, updatedAt: Date.now() })
        .where(eq(yarnLines.id, line.id))
      return
    }

    if (claim.fieldKey === 'productUrl') {
      await db
        .update(yarnLines)
        .set({ productUrl: claim.proposedValue, updatedAt: Date.now() })
        .where(eq(yarnLines.id, line.id))
      return
    }

    if (claim.fieldKey === 'colorway_add') {
      try {
        const parsed = JSON.parse(claim.proposedValue) as {
          name?: string
          colorCode?: string
          hexReference?: string
        }
        const name = parsed.name?.trim()
        if (!name) {
          return
        }

        const existing = await db.query.yarnColorways.findFirst({
          where: and(eq(yarnColorways.yarnLineId, line.id), eq(yarnColorways.name, name)),
        })

        if (!existing) {
          await db.insert(yarnColorways).values({
            id: crypto.randomUUID(),
            yarnLineId: line.id,
            name,
            colorCode: parsed.colorCode?.trim() || null,
            hexReference: parsed.hexReference?.trim() || null,
          })
        }
      } catch {
        return
      }
      return
    }
  }

  if (claim.entityType === 'colorway') {
    const colorway = await db.query.yarnColorways.findFirst({ where: eq(yarnColorways.id, claim.entityId) })
    if (!colorway) {
      return
    }

    if (claim.fieldKey === 'name') {
      await db
        .update(yarnColorways)
        .set({ name: claim.proposedValue, updatedAt: Date.now() })
        .where(eq(yarnColorways.id, colorway.id))
      return
    }

    if (claim.fieldKey === 'colorCode') {
      await db
        .update(yarnColorways)
        .set({ colorCode: claim.proposedValue, updatedAt: Date.now() })
        .where(eq(yarnColorways.id, colorway.id))
      return
    }

    if (claim.fieldKey === 'hexReference') {
      await db
        .update(yarnColorways)
        .set({ hexReference: claim.proposedValue, updatedAt: Date.now() })
        .where(eq(yarnColorways.id, colorway.id))
      return
    }
  }
}
