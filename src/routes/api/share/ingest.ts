import { createFileRoute } from '@tanstack/react-router'

import { ingestSharedPayload } from '#/lib/share/ingest'

export const Route = createFileRoute('/api/share/ingest')({
  server: {
    handlers: {
      POST: async ({ request }) => ingestSharedPayload(request),
    },
  },
})
