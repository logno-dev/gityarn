import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'
import { patterns } from '#/lib/db/schema'

const MAX_PDF_BYTES = 40 * 1024 * 1024
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const Route = createFileRoute('/api/patterns/$patternId/upload')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const pattern = await db.query.patterns.findFirst({ where: and(eq(patterns.id, params.patternId), eq(patterns.userId, authUser.id)) })
        if (!pattern) {
          return Response.json({ message: 'Pattern not found.' }, { status: 404 })
        }

        const formData = await request.formData()
        const kind = (formData.get('kind') ?? '').toString().trim().toLowerCase()
        const file = formData.get('file')
        if (!(file instanceof File)) {
          return Response.json({ message: 'File is required.' }, { status: 400 })
        }

        const isPdf = kind === 'pdf'
        const isCover = kind === 'cover'
        if (!isPdf && !isCover) {
          return Response.json({ message: 'kind must be pdf or cover.' }, { status: 400 })
        }

        if (isPdf) {
          if (file.type !== 'application/pdf') {
            return Response.json({ message: 'Pattern file must be a PDF.' }, { status: 400 })
          }
          if (file.size > MAX_PDF_BYTES) {
            return Response.json({ message: 'PDF must be 40MB or smaller.' }, { status: 400 })
          }
        }

        if (isCover) {
          if (!IMAGE_MIME_TYPES.has(file.type)) {
            return Response.json({ message: 'Cover image must be JPG, PNG, WEBP, or GIF.' }, { status: 400 })
          }
          if (file.size > MAX_IMAGE_BYTES) {
            return Response.json({ message: 'Cover image must be 8MB or smaller.' }, { status: 400 })
          }
        }

        const ext = isPdf ? 'pdf' : mimeToImageExt(file.type)
        const r2Key = `users/${authUser.id}/patterns/${pattern.id}/${isPdf ? 'file' : 'cover'}-${crypto.randomUUID()}.${ext}`
        const bytes = new Uint8Array(await file.arrayBuffer())
        const env = getServerEnv()

        await getR2Client().send(
          new PutObjectCommand({
            Bucket: env.R2_BUCKET,
            Key: r2Key,
            Body: bytes,
            ContentType: file.type,
          }),
        )

        const now = Date.now()
        const updatePayload: {
          pdfR2Key?: string | null
          pdfMimeType?: string | null
          pdfFileName?: string | null
          coverR2Key?: string | null
          coverMimeType?: string | null
          updatedAt: number
        } = { updatedAt: now }

        if (isPdf) {
          updatePayload.pdfR2Key = r2Key
          updatePayload.pdfMimeType = file.type
          updatePayload.pdfFileName = file.name || `${pattern.title}.pdf`
          if (pattern.pdfR2Key) {
            await safeDeleteObject(pattern.pdfR2Key)
          }
        } else {
          updatePayload.coverR2Key = r2Key
          updatePayload.coverMimeType = file.type
          if (pattern.coverR2Key) {
            await safeDeleteObject(pattern.coverR2Key)
          }
        }

        await db.update(patterns).set(updatePayload).where(and(eq(patterns.id, pattern.id), eq(patterns.userId, authUser.id)))

        return Response.json({ message: isPdf ? 'Pattern PDF uploaded.' : 'Pattern cover uploaded.', updatedAt: now }, { status: 200 })
      },
    },
  },
})

async function safeDeleteObject(key: string) {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getServerEnv().R2_BUCKET,
      Key: key,
    }),
  )
}

function mimeToImageExt(mimeType: string) {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}
