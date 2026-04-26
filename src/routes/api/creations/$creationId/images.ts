import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { and, asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { creationImages, creations } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const Route = createFileRoute('/api/creations/$creationId/images')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const creation = await getDb().query.creations.findFirst({ where: eq(creations.id, params.creationId) })
        if (!creation) return Response.json({ message: 'Creation not found.' }, { status: 404 })
        if (!creation.isPublic && creation.userId !== authUser.id) {
          return Response.json({ message: 'Forbidden' }, { status: 403 })
        }

        const imageId = new URL(request.url).searchParams.get('imageId')?.trim() ?? ''
        if (imageId) {
          const image = await getDb().query.creationImages.findFirst({
            where: and(eq(creationImages.id, imageId), eq(creationImages.creationId, params.creationId)),
          })
          if (!image) return Response.json({ message: 'Image not found.' }, { status: 404 })

          const result = await getR2Client().send(
            new GetObjectCommand({
              Bucket: getServerEnv().R2_BUCKET,
              Key: image.r2Key,
            }),
          )
          const bytes = await result.Body?.transformToByteArray()
          if (!bytes) return Response.json({ message: 'Image unavailable.' }, { status: 404 })
          const safeBytes = new Uint8Array(bytes.byteLength)
          safeBytes.set(bytes)
          return new Response(new Blob([safeBytes], { type: image.mimeType ?? 'image/jpeg' }), {
            status: 200,
            headers: {
              'Content-Type': image.mimeType ?? 'image/jpeg',
              'Cache-Control': 'private, max-age=300',
            },
          })
        }

        const rows = await getDb()
          .select({
            id: creationImages.id,
            mimeType: creationImages.mimeType,
            createdAt: creationImages.createdAt,
            updatedAt: creationImages.updatedAt,
          })
          .from(creationImages)
          .where(eq(creationImages.creationId, params.creationId))
          .orderBy(asc(creationImages.createdAt))

        return Response.json(
          {
            images: rows.map((row) => ({
              ...row,
              src: `/api/creations/${params.creationId}/images?imageId=${row.id}`,
            })),
          },
          { status: 200 },
        )
      },
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const creation = await getDb()
          .query.creations.findFirst({ where: and(eq(creations.id, params.creationId), eq(creations.userId, authUser.id)) })
        if (!creation) return Response.json({ message: 'Creation not found.' }, { status: 404 })

        const formData = await request.formData()
        const files = formData.getAll('files').filter((value): value is File => value instanceof File)
        if (!files.length) {
          return Response.json({ message: 'At least one image file is required.' }, { status: 400 })
        }

        const validFiles = files.slice(0, 8)
        const env = getServerEnv()
        const db = getDb()
        const now = Date.now()
        const inserts: Array<typeof creationImages.$inferInsert> = []

        for (const file of validFiles) {
          if (!IMAGE_MIME_TYPES.has(file.type)) {
            return Response.json({ message: 'Only JPG, PNG, WEBP, or GIF files are allowed.' }, { status: 400 })
          }
          if (file.size > MAX_IMAGE_BYTES) {
            return Response.json({ message: 'Each image must be 8MB or smaller.' }, { status: 400 })
          }
          const ext = mimeToExt(file.type)
          const key = `users/${authUser.id}/creations/${creation.id}/${crypto.randomUUID()}.${ext}`
          await getR2Client().send(
            new PutObjectCommand({
              Bucket: env.R2_BUCKET,
              Key: key,
              Body: new Uint8Array(await file.arrayBuffer()),
              ContentType: file.type,
            }),
          )
          inserts.push({
            id: crypto.randomUUID(),
            creationId: creation.id,
            userId: authUser.id,
            r2Key: key,
            mimeType: file.type,
            byteSize: file.size,
            createdAt: now,
            updatedAt: now,
          })
        }

        if (inserts.length) {
          await db.insert(creationImages).values(inserts)
          await db.update(creations).set({ updatedAt: now }).where(eq(creations.id, creation.id))
        }

        return Response.json({ message: `Uploaded ${inserts.length} image(s).` }, { status: 200 })
      },
      DELETE: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const body = (await request.json()) as { imageId?: string }
        if (!body.imageId) return Response.json({ message: 'imageId is required.' }, { status: 400 })

        const image = await getDb().query.creationImages.findFirst({
          where: and(eq(creationImages.id, body.imageId), eq(creationImages.creationId, params.creationId), eq(creationImages.userId, authUser.id)),
        })
        if (!image) return Response.json({ message: 'Image not found.' }, { status: 404 })

        await getR2Client().send(
          new DeleteObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: image.r2Key,
          }),
        )
        await getDb().delete(creationImages).where(eq(creationImages.id, image.id))
        await getDb().update(creations).set({ updatedAt: Date.now() }).where(eq(creations.id, params.creationId))

        return Response.json({ message: 'Image removed.' }, { status: 200 })
      },
    },
  },
})

function mimeToExt(mimeType: string) {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}
