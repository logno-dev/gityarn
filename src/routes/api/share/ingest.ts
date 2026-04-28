import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { shareInboxFiles, shareInboxItems } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { processUploadedImage } from '#/lib/image/resize'
import { getR2Client } from '#/lib/r2/client'

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const PDF_MIME_TYPE = 'application/pdf'

export const Route = createFileRoute('/api/share/ingest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return new Response(null, {
            status: 303,
            headers: { Location: '/sign-in' },
          })
        }

        const formData = await request.formData()
        const title = (formData.get('title') ?? '').toString().trim() || null
        const text = (formData.get('text') ?? '').toString().trim() || null
        const url = (formData.get('url') ?? '').toString().trim() || null
        const sharedFiles = formData.getAll('files').filter((value): value is File => value instanceof File).slice(0, 10)

        const hasPayload = Boolean(title || text || url || sharedFiles.length)
        if (!hasPayload) {
          return new Response(null, {
            status: 303,
            headers: { Location: '/share-intake?error=No+shared+content+found' },
          })
        }

        const now = Date.now()
        const draftId = crypto.randomUUID()
        const db = getDb()

        await db.insert(shareInboxItems).values({
          id: draftId,
          userId: authUser.id,
          title,
          text,
          url,
          createdAt: now,
          updatedAt: now,
        })

        const env = getServerEnv()
        const fileRows: Array<typeof shareInboxFiles.$inferInsert> = []

        for (const file of sharedFiles) {
          const mimeType = normalizeShareMimeType(file.type)
          if (!mimeType) {
            continue
          }

          const processed = mimeType === PDF_MIME_TYPE ? await passthroughFile(file) : await processUploadedImage(file, { maxWidth: 1600 })
          const key = `users/${authUser.id}/share-inbox/${draftId}/${crypto.randomUUID()}.${processed.extension}`
          await getR2Client().send(
            new PutObjectCommand({
              Bucket: env.R2_BUCKET,
              Key: key,
              Body: processed.bytes,
              ContentType: processed.mimeType,
            }),
          )

          fileRows.push({
            id: crypto.randomUUID(),
            draftId,
            userId: authUser.id,
            kind: processed.mimeType === PDF_MIME_TYPE ? 'pdf' : 'image',
            originalFileName: file.name || null,
            r2Key: key,
            mimeType: processed.mimeType,
            byteSize: processed.bytes.byteLength,
            createdAt: now,
            updatedAt: now,
          })
        }

        if (fileRows.length) {
          await db.insert(shareInboxFiles).values(fileRows)
        }

        return new Response(null, {
          status: 303,
          headers: { Location: `/share-intake?draftId=${encodeURIComponent(draftId)}` },
        })
      },
    },
  },
})

async function passthroughFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return {
    bytes,
    mimeType: PDF_MIME_TYPE,
    extension: 'pdf',
  }
}

function normalizeShareMimeType(mimeType: string) {
  if (IMAGE_MIME_TYPES.has(mimeType)) return mimeType
  if (mimeType === PDF_MIME_TYPE) return mimeType
  return null
}
