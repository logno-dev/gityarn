import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { getServerEnv } from '#/lib/env'
import { generatePatternPdfPreview } from '#/lib/patterns/pdf-preview'
import { getR2Client } from '#/lib/r2/client'
import { patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId/attach-upload')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const db = getDb()
        const pattern = await db.query.patterns.findFirst({
          where: and(eq(patterns.id, params.patternId), eq(patterns.userId, authUser.id)),
        })
        if (!pattern) return Response.json({ message: 'Pattern not found.' }, { status: 404 })

        const body = (await request.json()) as { kind?: 'pdf' | 'cover'; key?: string; fileName?: string }
        const kind = body.kind
        const key = body.key?.trim() ?? ''
        if ((kind !== 'pdf' && kind !== 'cover') || !key) {
          return Response.json({ message: 'kind and key are required.' }, { status: 400 })
        }

        const head = await getR2Client().send(
          new HeadObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: key,
          }),
        )

        const now = Date.now()
        if (kind === 'pdf') {
          if (pattern.pdfR2Key) {
            await getR2Client().send(new DeleteObjectCommand({ Bucket: getServerEnv().R2_BUCKET, Key: pattern.pdfR2Key }))
          }
          if (pattern.pdfPreviewR2Key) {
            await getR2Client().send(new DeleteObjectCommand({ Bucket: getServerEnv().R2_BUCKET, Key: pattern.pdfPreviewR2Key }))
          }
          const preview = await generatePatternPdfPreview({
            userId: authUser.id,
            patternId: pattern.id,
            pdfR2Key: key,
          })
          await db
            .update(patterns)
            .set({
              pdfR2Key: key,
              pdfMimeType: 'application/pdf',
              pdfFileName: body.fileName?.trim() || `${pattern.title}.pdf`,
              pdfPreviewR2Key: preview?.key ?? null,
              pdfPreviewMimeType: preview?.mimeType ?? null,
              updatedAt: now,
            })
            .where(and(eq(patterns.id, pattern.id), eq(patterns.userId, authUser.id)))
          return Response.json({ message: 'Pattern PDF uploaded.' }, { status: 200 })
        }

        if (pattern.coverR2Key) {
          await getR2Client().send(new DeleteObjectCommand({ Bucket: getServerEnv().R2_BUCKET, Key: pattern.coverR2Key }))
        }
        await db
          .update(patterns)
          .set({
            coverR2Key: key,
            coverMimeType: head.ContentType || 'image/jpeg',
            updatedAt: now,
          })
          .where(and(eq(patterns.id, pattern.id), eq(patterns.userId, authUser.id)))

        return Response.json({ message: 'Pattern cover uploaded.' }, { status: 200 })
      },
    },
  },
})
