import { createFileRoute } from '@tanstack/react-router'

import { signInWithPassword } from '#/lib/auth/service'
import { sessionCookieValue } from '#/lib/auth/session'

export const Route = createFileRoute('/api/auth/sign-in')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            email?: string
            password?: string
          }

          if (!body.email || !body.password) {
            return Response.json({ message: 'Email and password are required.' }, { status: 400 })
          }

          const result = await signInWithPassword({
            email: body.email,
            password: body.password,
          })

          return new Response(
            JSON.stringify({ message: 'Signed in.', user: result.user }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': sessionCookieValue(result.sessionToken, result.sessionExpiresAt),
              },
            },
          )
        } catch (error) {
          return Response.json({ message: (error as Error).message }, { status: 401 })
        }
      },
    },
  },
})
