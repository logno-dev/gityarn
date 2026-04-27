import { GetObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getDb } from '#/lib/db/client'
import { carouselItems } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'

export const Route = createFileRoute('/api/landing/carousel/$itemId/image')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const item = await getDb().query.carouselItems.findFirst({ where: eq(carouselItems.id, params.itemId) })
        if (!item || !item.isActive) {
          return Response.json({ message: 'Image not found.' }, { status: 404 })
        }

        const result = await getR2Client().send(
          new GetObjectCommand({
            Bucket: getServerEnv().R2_BUCKET,
            Key: item.imageR2Key,
          }),
        )

        const bytes = await result.Body?.transformToByteArray()
        if (!bytes) {
          return Response.json({ message: 'Image unavailable.' }, { status: 404 })
        }

        const safeBytes = new Uint8Array(bytes.byteLength)
        safeBytes.set(bytes)

        return new Response(new Blob([safeBytes], { type: item.imageMimeType ?? 'image/jpeg' }), {
          status: 200,
          headers: {
            'Content-Type': item.imageMimeType ?? 'image/jpeg',
            'Cache-Control': 'public, max-age=300',
          },
        })
      },
    },
  },
})
