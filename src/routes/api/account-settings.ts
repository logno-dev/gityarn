import { and, eq, gt, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { assetFiles, sessions, users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/account-settings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const user = await db.query.users.findFirst({ where: eq(users.id, authUser.id) })
        if (!user) {
          return Response.json({ message: 'Account not found.' }, { status: 404 })
        }

        const now = Date.now()
        const [sessionCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(sessions)
          .where(and(eq(sessions.userId, authUser.id), gt(sessions.expiresAt, now)))

        const latestAvatar = await db.query.assetFiles.findFirst({
          where: and(eq(assetFiles.userId, authUser.id), eq(assetFiles.kind, 'profile-avatar')),
          orderBy: (table, { desc }) => [desc(table.updatedAt)],
        })

        return Response.json(
          {
            profile: {
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              bio: user.bio,
              websiteUrl: user.websiteUrl,
              instagramUrl: user.instagramUrl,
              etsyUrl: user.etsyUrl,
              ravelryUrl: user.ravelryUrl,
              tiktokUrl: user.tiktokUrl,
              youtubeUrl: user.youtubeUrl,
              role: user.role,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              avatarUpdatedAt: latestAvatar?.updatedAt ?? null,
            },
            security: {
              activeSessionCount: Number(sessionCountRow?.count) || 0,
            },
          },
          { status: 200 },
        )
      },
      PATCH: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as {
          displayName?: string
          email?: string
          bio?: string | null
          websiteUrl?: string | null
          instagramUrl?: string | null
          etsyUrl?: string | null
          ravelryUrl?: string | null
          tiktokUrl?: string | null
          youtubeUrl?: string | null
        }
        const displayName = body.displayName?.trim() ?? ''
        const email = body.email?.trim().toLowerCase() ?? ''

        if (!displayName || !email) {
          return Response.json({ message: 'Display name and email are required.' }, { status: 400 })
        }

        const db = getDb()
        const existingEmailOwner = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (existingEmailOwner && existingEmailOwner.id !== authUser.id) {
          return Response.json({ message: 'Email is already in use.' }, { status: 400 })
        }

        await db
          .update(users)
          .set({
            displayName,
            email,
            bio: normalizeOptionalText(body.bio),
            websiteUrl: normalizeOptionalUrl(body.websiteUrl),
            instagramUrl: normalizeOptionalUrl(body.instagramUrl),
            etsyUrl: normalizeOptionalUrl(body.etsyUrl),
            ravelryUrl: normalizeOptionalUrl(body.ravelryUrl),
            tiktokUrl: normalizeOptionalUrl(body.tiktokUrl),
            youtubeUrl: normalizeOptionalUrl(body.youtubeUrl),
            updatedAt: Date.now(),
          })
          .where(eq(users.id, authUser.id))

        return Response.json({ message: 'Account profile updated.' }, { status: 200 })
      },
    },
  },
})

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeOptionalUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  return `https://${trimmed}`
}
