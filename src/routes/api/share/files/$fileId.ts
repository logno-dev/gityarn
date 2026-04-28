import { GetObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { shareInboxFiles } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'

export const Route = createFileRoute('/api/share/files/$fileId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const file = await getDb().query.shareInboxFiles.findFirst({
          where: and(eq(shareInboxFiles.id, params.fileId), eq(shareInboxFiles.userId, authUser.id)),
        })
        if (!file) return Response.json({ message: 'Shared file not found.' }, { status: 404 })

        const result = await getR2Client().send(
          new GetObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: file.r2Key,
          }),
        )
        const bytes = await result.Body?.transformToByteArray()
        if (!bytes) return Response.json({ message: 'Shared file unavailable.' }, { status: 404 })

        const safeBytes = new Uint8Array(bytes.byteLength)
        safeBytes.set(bytes)
        return new Response(new Blob([safeBytes], { type: file.mimeType ?? 'application/octet-stream' }), {
          status: 200,
          headers: {
            'Content-Type': file.mimeType ?? 'application/octet-stream',
            'Cache-Control': 'private, max-age=120',
          },
        })
      },
    },
  },
})
