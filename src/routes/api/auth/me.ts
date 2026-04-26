import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'

export const Route = createFileRoute('/api/auth/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!user) {
          return Response.json({ user: null }, { status: 200 })
        }

        return Response.json({ user }, { status: 200 })
      },
    },
  },
})
