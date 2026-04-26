import { desc, eq, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { communityClaimVotes, communityClaims, communityFlags, inventoryYarn, users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/admin/overview')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }
        if (authUser.role !== 'admin') {
          return Response.json({ message: 'Forbidden' }, { status: 403 })
        }

        const db = getDb()

        const [usersCountRow] = await db.select({ count: sql<number>`count(*)` }).from(users)
        const [adminsCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.role, 'admin'))
        const [openClaimsRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(communityClaims)
          .where(eq(communityClaims.status, 'open'))
        const [openFlagsRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(communityFlags)
          .where(eq(communityFlags.status, 'open'))
        const [inventoryCountRow] = await db.select({ count: sql<number>`count(*)` }).from(inventoryYarn)

        const userRows = await db
          .select({
            id: users.id,
            displayName: users.displayName,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(desc(users.createdAt))
          .limit(120)

        const claimRows = await db
          .select({
            id: communityClaims.id,
            entityType: communityClaims.entityType,
            fieldKey: communityClaims.fieldKey,
            proposedValue: communityClaims.proposedValue,
            createdByName: users.displayName,
            agreeCount: sql<number>`sum(case when ${communityClaimVotes.vote} = 'agree' then 1 else 0 end)`,
            disagreeCount: sql<number>`sum(case when ${communityClaimVotes.vote} = 'disagree' then 1 else 0 end)`,
            createdAt: communityClaims.createdAt,
          })
          .from(communityClaims)
          .innerJoin(users, eq(communityClaims.createdByUserId, users.id))
          .leftJoin(communityClaimVotes, eq(communityClaimVotes.claimId, communityClaims.id))
          .where(eq(communityClaims.status, 'open'))
          .groupBy(communityClaims.id, users.displayName)
          .orderBy(desc(communityClaims.createdAt))
          .limit(20)

        const flagRows = await db
          .select({
            id: communityFlags.id,
            entityType: communityFlags.entityType,
            reason: communityFlags.reason,
            details: communityFlags.details,
            createdByName: users.displayName,
            createdAt: communityFlags.createdAt,
          })
          .from(communityFlags)
          .innerJoin(users, eq(communityFlags.createdByUserId, users.id))
          .where(eq(communityFlags.status, 'open'))
          .orderBy(desc(communityFlags.createdAt))
          .limit(20)

        return Response.json(
          {
            stats: {
              users: Number(usersCountRow?.count) || 0,
              admins: Number(adminsCountRow?.count) || 0,
              openClaims: Number(openClaimsRow?.count) || 0,
              openFlags: Number(openFlagsRow?.count) || 0,
              inventoryEntries: Number(inventoryCountRow?.count) || 0,
            },
            users: userRows.map((user) => ({
              ...user,
              role: user.role === 'admin' ? 'admin' : 'member',
            })),
            openClaims: claimRows,
            openFlags: flagRows,
          },
          { status: 200 },
        )
      },
    },
  },
})
