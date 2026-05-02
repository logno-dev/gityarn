import { GetObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'
import { patternFileVariants, patterns } from '#/lib/db/schema'

export const Route = createFileRoute('/api/patterns/$patternId/file')({
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
        if (!pattern.pdfR2Key) {
          const variants = await getDb().query.patternFileVariants.findMany({ where: eq(patternFileVariants.patternId, pattern.id) })
          if (!variants.length) {
            return Response.json({ message: 'Pattern file not uploaded.' }, { status: 404 })
          }
        }

        const requestedLang = new URL(request.url).searchParams.get('lang')?.trim() ?? ''
        const variant = requestedLang
          ? await getDb().query.patternFileVariants.findFirst({ where: and(eq(patternFileVariants.patternId, pattern.id), eq(patternFileVariants.languageCode, requestedLang)) })
          : null
        const fallbackVariant = !variant
          ? await getDb().query.patternFileVariants.findFirst({ where: eq(patternFileVariants.patternId, pattern.id) })
          : null

        const targetKey = variant?.r2Key ?? fallbackVariant?.r2Key ?? pattern.pdfR2Key
        const targetMimeType = variant?.mimeType ?? fallbackVariant?.mimeType ?? pattern.pdfMimeType ?? 'application/pdf'
        const targetFileName = variant?.fileName ?? fallbackVariant?.fileName ?? pattern.pdfFileName ?? `${pattern.title}.pdf`
        if (!targetKey) {
          return Response.json({ message: 'Pattern file not uploaded.' }, { status: 404 })
        }

        const result = await getR2Client().send(
          new GetObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: targetKey,
          }),
        )
        const bytes = await result.Body?.transformToByteArray()
        if (!bytes) {
          return Response.json({ message: 'Pattern file unavailable.' }, { status: 404 })
        }

        const safeBytes = new Uint8Array(bytes.byteLength)
        safeBytes.set(bytes)

        return new Response(new Blob([safeBytes], { type: targetMimeType }), {
          status: 200,
          headers: {
            'Content-Type': targetMimeType,
            'Content-Disposition': `inline; filename="${sanitizeFileName(targetFileName)}"`,
          },
        })
      },
    },
  },
})

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\r\n"\\]/g, '').trim() || 'pattern.pdf'
}
