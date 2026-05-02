import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { getServerEnv } from '#/lib/env'
import { normalizePatternLanguage } from '#/lib/patterns/languages'
import { getR2Client } from '#/lib/r2/client'
import { patterns } from '#/lib/db/schema'

const MAX_PDF_BYTES = 40 * 1024 * 1024
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export const Route = createFileRoute('/api/patterns/$patternId/upload-url')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const pattern = await getDb().query.patterns.findFirst({
          where: and(eq(patterns.id, params.patternId), eq(patterns.userId, authUser.id)),
        })
        if (!pattern) return Response.json({ message: 'Pattern not found.' }, { status: 404 })

        const body = (await request.json()) as {
          kind?: 'pdf' | 'cover'
          fileName?: string
          mimeType?: string
          byteSize?: number
          languageCode?: string
        }

        const kind = body.kind
        const language = normalizePatternLanguage(body.languageCode)
        if (kind !== 'pdf' && kind !== 'cover') {
          return Response.json({ message: 'kind must be pdf or cover.' }, { status: 400 })
        }

        const mimeType = (body.mimeType ?? '').trim().toLowerCase()
        const fileName = (body.fileName ?? '').trim()
        const byteSize = Number(body.byteSize ?? 0)

        if (kind === 'pdf') {
          if (!looksLikePdf(mimeType, fileName)) {
            return Response.json({ message: 'Pattern file must be a PDF.' }, { status: 400 })
          }
          if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_PDF_BYTES) {
            return Response.json({ message: 'PDF must be 40MB or smaller.' }, { status: 400 })
          }
        } else {
          if (!looksLikeSupportedImage(mimeType, fileName)) {
            return Response.json({ message: 'Cover image must be JPG, PNG, WEBP, GIF, HEIC, or HEIF.' }, { status: 400 })
          }
          if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_IMAGE_BYTES) {
            return Response.json({ message: 'Cover image must be 20MB or smaller.' }, { status: 400 })
          }
        }

        const ext = extensionFor(kind, fileName, mimeType)
        const normalizedMimeType = kind === 'pdf' ? 'application/pdf' : normalizeImageMime(mimeType, fileName)
        const key = `users/${authUser.id}/patterns/${pattern.id}/${kind}${kind === 'pdf' ? `-${language.code}` : ''}-${crypto.randomUUID()}.${ext}`

        const uploadUrl = await getSignedUrl(
          getR2Client(),
          new PutObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: key,
            ContentType: normalizedMimeType,
          }),
          { expiresIn: 60 * 10 },
        )

        return Response.json({ uploadUrl, key, contentType: normalizedMimeType, languageCode: language.code, languageLabel: language.label }, { status: 200 })
      },
    },
  },
})

function looksLikePdf(mimeType: string, fileName: string) {
  if (mimeType === 'application/pdf') return true
  return (mimeType === 'application/octet-stream' || mimeType === '') && fileName.toLowerCase().endsWith('.pdf')
}

function looksLikeSupportedImage(mimeType: string, fileName: string) {
  const ok = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
  if (ok.has(mimeType)) return true
  if (mimeType && mimeType !== 'application/octet-stream') return false
  const name = fileName.toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'].some((ext) => name.endsWith(ext))
}

function extensionFor(kind: 'pdf' | 'cover', fileName: string, mimeType: string) {
  if (kind === 'pdf') return 'pdf'
  const name = fileName.toLowerCase()
  if (name.endsWith('.png')) return 'png'
  if (name.endsWith('.webp')) return 'webp'
  if (name.endsWith('.gif')) return 'gif'
  if (name.endsWith('.heic')) return 'heic'
  if (name.endsWith('.heif')) return 'heif'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/heic') return 'heic'
  if (mimeType === 'image/heif') return 'heif'
  return 'jpg'
}

function normalizeImageMime(mimeType: string, fileName: string) {
  if (mimeType.startsWith('image/')) return mimeType
  const name = fileName.toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.heic')) return 'image/heic'
  if (name.endsWith('.heif')) return 'image/heif'
  return 'image/jpeg'
}
