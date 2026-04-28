import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { shareInboxItems } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'
import { extensionForMimeType, normalizeShareMimeType } from '#/lib/share/files'

export const Route = createFileRoute('/api/share/upload-url')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const body = (await request.json()) as { draftId?: string; fileName?: string; mimeType?: string }
        const draftId = body.draftId?.trim() ?? ''
        const fileName = body.fileName?.trim() ?? 'shared-file'
        const mimeType = normalizeShareMimeType(body.mimeType?.trim() ?? '')

        if (!draftId || !mimeType) {
          return Response.json({ message: 'draftId and valid mimeType are required.' }, { status: 400 })
        }

        const draft = await getDb().query.shareInboxItems.findFirst({
          where: and(eq(shareInboxItems.id, draftId), eq(shareInboxItems.userId, authUser.id)),
        })
        if (!draft) return Response.json({ message: 'Shared draft not found.' }, { status: 404 })

        const ext = extensionForMimeType(mimeType)
        const key = `users/${authUser.id}/share-inbox/${draftId}/${crypto.randomUUID()}.${ext}`
        const uploadUrl = await getSignedUrl(
          getR2Client(),
          new PutObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: key,
            ContentType: mimeType,
          }),
          { expiresIn: 60 * 10 },
        )

        return Response.json(
          {
            uploadUrl,
            key,
            mimeType,
            originalFileName: fileName,
          },
          { status: 200 },
        )
      },
    },
  },
})
