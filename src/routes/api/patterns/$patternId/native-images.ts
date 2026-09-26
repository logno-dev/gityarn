import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { nativePatternRows, patterns } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { processUploadedImage } from '#/lib/image/resize'
import { getR2Client } from '#/lib/r2/client'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])

export const Route = createFileRoute('/api/patterns/$patternId/native-images')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const pattern = await getDb().query.patterns.findFirst({ where: eq(patterns.id, params.patternId) })
        if (!pattern || pattern.patternType !== 'native' || (pattern.userId !== authUser.id && (!pattern.isPublic || pattern.moderationStatus !== 'active'))) {
          return Response.json({ message: 'Pattern not found.' }, { status: 404 })
        }
        const blockId = new URL(request.url).searchParams.get('blockId')?.trim()
        if (!blockId) return Response.json({ message: 'blockId is required.' }, { status: 400 })
        const block = await getDb().query.nativePatternRows.findFirst({
          where: and(eq(nativePatternRows.id, blockId), eq(nativePatternRows.patternId, params.patternId)),
        })
        if (!block?.imageR2Key || block.blockType !== 'image') return Response.json({ message: 'Image not found.' }, { status: 404 })
        const result = await getR2Client().send(new GetObjectCommand({ Bucket: getServerEnv().R2_BUCKET, Key: block.imageR2Key }))
        const bytes = await result.Body?.transformToByteArray()
        if (!bytes) return Response.json({ message: 'Image unavailable.' }, { status: 404 })
        const safeBytes = new Uint8Array(bytes.byteLength)
        safeBytes.set(bytes)
        return new Response(new Blob([safeBytes], { type: block.imageMimeType ?? 'image/jpeg' }), {
          headers: { 'Content-Type': block.imageMimeType ?? 'image/jpeg', 'Cache-Control': 'private, max-age=300' },
        })
      },
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const pattern = await getDb().query.patterns.findFirst({ where: and(eq(patterns.id, params.patternId), eq(patterns.userId, authUser.id)) })
        if (!pattern || pattern.patternType !== 'native') return Response.json({ message: 'Native pattern not found.' }, { status: 404 })
        const formData = await request.formData()
        const file = formData.get('file')
        if (!(file instanceof File)) return Response.json({ message: 'Image file is required.' }, { status: 400 })
        if (!IMAGE_MIME_TYPES.has(file.type)) return Response.json({ message: 'Image must be JPG, PNG, WEBP, GIF, HEIC, or HEIF.' }, { status: 400 })
        if (file.size > MAX_IMAGE_BYTES) return Response.json({ message: 'Image must be 20MB or smaller.' }, { status: 400 })
        const processed = await processUploadedImage(file, { maxWidth: 1600 })
        const r2Key = `users/${authUser.id}/patterns/${pattern.id}/native/${crypto.randomUUID()}.${processed.extension}`
        await getR2Client().send(new PutObjectCommand({
          Bucket: getServerEnv().R2_BUCKET,
          Key: r2Key,
          Body: processed.bytes,
          ContentType: processed.mimeType,
        }))
        return Response.json({
          image: {
            r2Key,
            mimeType: processed.mimeType,
            byteSize: processed.bytes.byteLength,
          },
        }, { status: 201 })
      },
    },
  },
})
