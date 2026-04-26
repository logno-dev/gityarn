import { randomBytes } from 'node:crypto'

import { and, eq, gt, isNull } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'
import { Resend } from 'resend'

import { tokenToHash } from '#/lib/auth/session'
import { getDb } from '#/lib/db/client'
import { passwordResetTokens, users } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'

const RESET_TOKEN_VALID_MS = 60 * 60 * 1000

export const Route = createFileRoute('/api/auth/forgot-password')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { email?: string }
        const normalizedEmail = body.email?.trim().toLowerCase() ?? ''
        if (!normalizedEmail) {
          return Response.json({ message: 'If that email exists, a reset link has been sent.' }, { status: 200 })
        }

        const db = getDb()
        const user = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) })
        if (!user) {
          return Response.json({ message: 'If that email exists, a reset link has been sent.' }, { status: 200 })
        }

        const rawToken = randomBytes(32).toString('base64url')
        const tokenHash = tokenToHash(rawToken)
        const now = Date.now()
        const expiresAt = now + RESET_TOKEN_VALID_MS

        await db.insert(passwordResetTokens).values({
          id: crypto.randomUUID(),
          userId: user.id,
          tokenHash,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })

        const env = getServerEnv()
        if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
          return Response.json({ message: 'If that email exists, a reset link has been sent.' }, { status: 200 })
        }

        const baseUrl = env.APP_BASE_URL ?? new URL(request.url).origin
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`

        const resend = new Resend(env.RESEND_API_KEY)
        await resend.emails.send({
          from: env.RESEND_FROM_EMAIL,
          to: user.email,
          subject: 'Reset your GIT Yarn password',
          text: `We received a password reset request for your GIT Yarn account.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
        })

        const activeResetRows = await db
          .select({ id: passwordResetTokens.id })
          .from(passwordResetTokens)
          .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))

        if (activeResetRows.length > 5) {
          const overflowRows = activeResetRows.slice(0, activeResetRows.length - 5)
          for (const row of overflowRows) {
            await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, row.id))
          }
        }

        return Response.json({ message: 'If that email exists, a reset link has been sent.' }, { status: 200 })
      },
    },
  },
})
