import { GetObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'
import { patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId/preview')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, params.patternId) })
        if (!pattern) return Response.json({ message: 'Pattern not found.' }, { status: 404 })
        if (!pattern.isPublic && pattern.userId !== authUser.id) return Response.json({ message: 'Forbidden' }, { status: 403 })
        if (!pattern.pdfPreviewR2Key) return Response.json({ message: 'Preview not available.' }, { status: 404 })

        const result = await getR2Client().send(
          new GetObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: pattern.pdfPreviewR2Key,
          }),
        )
        const bytes = await result.Body?.transformToByteArray()
        if (!bytes) return Response.json({ message: 'Preview unavailable.' }, { status: 404 })

        return new Response(new Blob([new Uint8Array(bytes)], { type: pattern.pdfPreviewMimeType ?? 'image/jpeg' }), {
          status: 200,
          headers: {
            'Content-Type': pattern.pdfPreviewMimeType ?? 'image/jpeg',
            'Cache-Control': 'private, max-age=300',
          },
        })
      },
    },
  },
})
