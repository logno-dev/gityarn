import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { shareInboxFiles, shareInboxItems } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'
import { SHARE_PDF_MIME_TYPE, normalizeShareMimeType } from '#/lib/share/files'

export const Route = createFileRoute('/api/share/attach-upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const body = (await request.json()) as {
          draftId?: string
          key?: string
          mimeType?: string
          originalFileName?: string
        }
        const draftId = body.draftId?.trim() ?? ''
        const key = body.key?.trim() ?? ''
        const mimeType = normalizeShareMimeType(body.mimeType?.trim() ?? '')
        const originalFileName = body.originalFileName?.trim() ?? null
        if (!draftId || !key || !mimeType) {
          return Response.json({ message: 'draftId, key, and valid mimeType are required.' }, { status: 400 })
        }

        const draft = await getDb().query.shareInboxItems.findFirst({
          where: and(eq(shareInboxItems.id, draftId), eq(shareInboxItems.userId, authUser.id)),
        })
        if (!draft) return Response.json({ message: 'Shared draft not found.' }, { status: 404 })

        const head = await getR2Client().send(
          new HeadObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: key,
          }),
        )

        const now = Date.now()
        await getDb().insert(shareInboxFiles).values({
          id: crypto.randomUUID(),
          draftId,
          userId: authUser.id,
          kind: mimeType === SHARE_PDF_MIME_TYPE ? 'pdf' : 'image',
          originalFileName,
          r2Key: key,
          mimeType,
          byteSize: Number(head.ContentLength ?? 0),
          createdAt: now,
          updatedAt: now,
        })

        return Response.json({ message: 'Uploaded file attached.' }, { status: 201 })
      },
    },
  },
})
