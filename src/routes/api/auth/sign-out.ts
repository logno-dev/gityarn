import { createFileRoute } from '@tanstack/react-router'

import { signOut } from '#/lib/auth/service'
import { clearSessionCookieValue, parseCookie, SESSION_COOKIE_NAME } from '#/lib/auth/session'

export const Route = createFileRoute('/api/auth/sign-out')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = parseCookie(request.headers.get('cookie'), SESSION_COOKIE_NAME)
        await signOut(token)

        return new Response(JSON.stringify({ message: 'Signed out.' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': clearSessionCookieValue(),
          },
        })
      },
    },
  },
})
