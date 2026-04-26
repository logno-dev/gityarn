import { eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { hashPassword, verifyPassword } from '#/lib/auth/password'
import { getDb } from '#/lib/db/client'
import { users } from '#/lib/db/schema'

export const Route = createFileRoute('/api/account-settings/password')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const body = (await request.json()) as { currentPassword?: string; newPassword?: string }
        const currentPassword = body.currentPassword ?? ''
        const newPassword = body.newPassword ?? ''

        if (!currentPassword || !newPassword) {
          return Response.json({ message: 'Current and new passwords are required.' }, { status: 400 })
        }
        if (newPassword.length < 8) {
          return Response.json({ message: 'New password must be at least 8 characters.' }, { status: 400 })
        }

        const db = getDb()
        const user = await db.query.users.findFirst({ where: eq(users.id, authUser.id) })
        if (!user) {
          return Response.json({ message: 'User not found.' }, { status: 404 })
        }

        if (!verifyPassword(currentPassword, user.passwordHash)) {
          return Response.json({ message: 'Current password is incorrect.' }, { status: 400 })
        }

        await db
          .update(users)
          .set({
            passwordHash: hashPassword(newPassword),
            updatedAt: Date.now(),
          })
          .where(eq(users.id, authUser.id))

        return Response.json({ message: 'Password updated successfully.' }, { status: 200 })
      },
    },
  },
})
