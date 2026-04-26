import { createFileRoute } from '@tanstack/react-router'

import { signUpWithPassword } from '#/lib/auth/service'
import { sessionCookieValue } from '#/lib/auth/session'

export const Route = createFileRoute('/api/auth/sign-up')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            displayName?: string
            email?: string
            password?: string
          }

          if (!body.displayName || !body.email || !body.password) {
            return Response.json({ message: 'Display name, email, and password are required.' }, { status: 400 })
          }

          const result = await signUpWithPassword({
            displayName: body.displayName,
            email: body.email,
            password: body.password,
          })

          return new Response(
            JSON.stringify({ message: 'Account created.', user: result.user }),
            {
              status: 201,
              headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': sessionCookieValue(result.sessionToken, result.sessionExpiresAt),
              },
            },
          )
        } catch (error) {
          return Response.json({ message: (error as Error).message }, { status: 400 })
        }
      },
    },
  },
})
