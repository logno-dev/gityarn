import { GetObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { assetFiles } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'

export const Route = createFileRoute('/api/profiles/$userId/avatar')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const avatar = await getDb().query.assetFiles.findFirst({
          where: and(eq(assetFiles.userId, params.userId), eq(assetFiles.kind, 'profile-avatar')),
          orderBy: (table, { desc }) => [desc(table.updatedAt)],
        })

        if (!avatar) {
          return Response.json({ message: 'Avatar not found.' }, { status: 404 })
        }

        const result = await getR2Client().send(
          new GetObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: avatar.r2Key,
          }),
        )

        const bytes = await result.Body?.transformToByteArray()
        if (!bytes) {
          return Response.json({ message: 'Avatar data unavailable.' }, { status: 404 })
        }

        const safeBytes = new Uint8Array(bytes.byteLength)
        safeBytes.set(bytes)

        return new Response(new Blob([safeBytes], { type: avatar.mimeType ?? 'application/octet-stream' }), {
          status: 200,
          headers: {
            'Content-Type': avatar.mimeType ?? 'application/octet-stream',
            'Cache-Control': 'private, max-age=300',
          },
        })
      },
    },
  },
})
