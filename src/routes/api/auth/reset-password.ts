import { and, eq, gt, isNull } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { hashPassword } from '#/lib/auth/password'
import { tokenToHash } from '#/lib/auth/session'
import { getDb } from '#/lib/db/client'
import { passwordResetTokens, sessions, users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/auth/reset-password')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { token?: string; newPassword?: string }
        const token = body.token?.trim() ?? ''
        const newPassword = body.newPassword ?? ''

        if (!token || !newPassword) {
          return Response.json({ message: 'Token and new password are required.' }, { status: 400 })
        }
        if (newPassword.length < 8) {
          return Response.json({ message: 'New password must be at least 8 characters.' }, { status: 400 })
        }

        const db = getDb()
        const now = Date.now()
        const tokenHash = tokenToHash(token)

        const resetToken = await db.query.passwordResetTokens.findFirst({
          where: and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        })

        if (!resetToken) {
          return Response.json({ message: 'Reset link is invalid or expired.' }, { status: 400 })
        }

        await db
          .update(users)
          .set({
            passwordHash: hashPassword(newPassword),
            updatedAt: now,
          })
          .where(eq(users.id, resetToken.userId))

        await db
          .update(passwordResetTokens)
          .set({
            usedAt: now,
            updatedAt: now,
          })
          .where(eq(passwordResetTokens.id, resetToken.id))

        await db.delete(sessions).where(eq(sessions.userId, resetToken.userId))

        return Response.json({ message: 'Password reset successfully. Please sign in.' }, { status: 200 })
      },
    },
  },
})
