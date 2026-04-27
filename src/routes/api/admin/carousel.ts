import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { carouselItems } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { processUploadedImage } from '#/lib/image/resize'
import { getR2Client } from '#/lib/r2/client'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 20 * 1024 * 1024

export const Route = createFileRoute('/api/admin/carousel')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        if (authUser.role !== 'admin') return Response.json({ message: 'Forbidden' }, { status: 403 })

        const formData = await request.formData()
        const image = formData.get('image')
        const altText = (formData.get('altText') ?? '').toString().trim()
        const linkUrlInput = (formData.get('linkUrl') ?? '').toString().trim()
        const sortOrder = Number.parseInt((formData.get('sortOrder') ?? '0').toString(), 10) || 0
        const isActive = (formData.get('isActive') ?? '1').toString() !== '0'

        if (!(image instanceof File)) {
          return Response.json({ message: 'Carousel image is required.' }, { status: 400 })
        }
        if (!ALLOWED_MIME_TYPES.has(image.type)) {
          return Response.json({ message: 'Only JPG, PNG, WEBP, or GIF images are allowed.' }, { status: 400 })
        }
        if (image.size > MAX_BYTES) {
          return Response.json({ message: 'Carousel image must be 20MB or smaller.' }, { status: 400 })
        }

        const linkUrl = normalizeOptionalLink(linkUrlInput)
        if (linkUrlInput && !linkUrl) {
          return Response.json({ message: 'Link must start with https://, http://, or /.' }, { status: 400 })
        }

        const processed = await processUploadedImage(image, { maxWidth: 1800 })
        const env = getServerEnv()
        const db = getDb()
        const now = Date.now()
        const id = crypto.randomUUID()
        const key = `site/carousel/${id}/${crypto.randomUUID()}.${processed.extension}`

        await getR2Client().send(
          new PutObjectCommand({
            Bucket: env.R2_BUCKET,
            Key: key,
            Body: processed.bytes,
            ContentType: processed.mimeType,
          }),
        )

        await db.insert(carouselItems).values({
          id,
          createdByUserId: authUser.id,
          imageR2Key: key,
          imageMimeType: processed.mimeType,
          imageByteSize: processed.bytes.byteLength,
          altText: altText || null,
          linkUrl,
          sortOrder,
          isActive,
          createdAt: now,
          updatedAt: now,
        })

        return Response.json({ message: 'Carousel item added.' }, { status: 201 })
      },
      PATCH: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        if (authUser.role !== 'admin') return Response.json({ message: 'Forbidden' }, { status: 403 })

        const body = (await request.json()) as {
          id?: string
          altText?: string
          linkUrl?: string
          sortOrder?: number
          isActive?: boolean
        }

        const id = body.id?.trim() ?? ''
        if (!id) return Response.json({ message: 'id is required.' }, { status: 400 })

        const existing = await getDb().query.carouselItems.findFirst({ where: eq(carouselItems.id, id) })
        if (!existing) return Response.json({ message: 'Carousel item not found.' }, { status: 404 })

        const nextAltText = (body.altText ?? existing.altText ?? '').trim() || null
        const rawLink = (body.linkUrl ?? existing.linkUrl ?? '').trim()
        const linkUrl = normalizeOptionalLink(rawLink)
        if (rawLink && !linkUrl) {
          return Response.json({ message: 'Link must start with https://, http://, or /.' }, { status: 400 })
        }

        const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : existing.sortOrder
        const isActive = typeof body.isActive === 'boolean' ? body.isActive : existing.isActive

        await getDb()
          .update(carouselItems)
          .set({
            altText: nextAltText,
            linkUrl,
            sortOrder,
            isActive,
            updatedAt: Date.now(),
          })
          .where(eq(carouselItems.id, id))

        return Response.json({ message: 'Carousel item updated.' }, { status: 200 })
      },
      DELETE: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        if (authUser.role !== 'admin') return Response.json({ message: 'Forbidden' }, { status: 403 })

        const body = (await request.json()) as { id?: string }
        const id = body.id?.trim() ?? ''
        if (!id) return Response.json({ message: 'id is required.' }, { status: 400 })

        const existing = await getDb().query.carouselItems.findFirst({ where: eq(carouselItems.id, id) })
        if (!existing) return Response.json({ message: 'Carousel item not found.' }, { status: 404 })

        await getR2Client().send(
          new DeleteObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: existing.imageR2Key,
          }),
        )

        await getDb().delete(carouselItems).where(eq(carouselItems.id, id))
        return Response.json({ message: 'Carousel item removed.' }, { status: 200 })
      },
    },
  },
})

function normalizeOptionalLink(value: string) {
  if (!value) return null
  if (value.startsWith('/')) return value
  if (value.startsWith('https://') || value.startsWith('http://')) return value
  return null
}
