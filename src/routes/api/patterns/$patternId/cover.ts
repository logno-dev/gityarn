import { GetObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'
import { patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId/cover')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, params.patternId) })
        if (!pattern) {
          return Response.json({ message: 'Pattern not found.' }, { status: 404 })
        }
        if (!pattern.isPublic && pattern.userId !== authUser.id) {
          return Response.json({ message: 'Forbidden' }, { status: 403 })
        }
        if (!pattern.coverR2Key) {
          return Response.json({ message: 'Pattern cover not uploaded.' }, { status: 404 })
        }

        const result = await getR2Client().send(
          new GetObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: pattern.coverR2Key,
          }),
        )
        const bytes = await result.Body?.transformToByteArray()
        if (!bytes) {
          return Response.json({ message: 'Pattern cover unavailable.' }, { status: 404 })
        }

        const safeBytes = new Uint8Array(bytes.byteLength)
        safeBytes.set(bytes)

        return new Response(new Blob([safeBytes], { type: pattern.coverMimeType ?? 'image/jpeg' }), {
          status: 200,
          headers: {
            'Content-Type': pattern.coverMimeType ?? 'image/jpeg',
            'Cache-Control': 'private, max-age=300',
          },
        })
      },
    },
  },
})
