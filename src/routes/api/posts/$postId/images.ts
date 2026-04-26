import { GetObjectCommand } from '@aws-sdk/client-s3'
import { and, asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'
import { postImages, posts } from '#/lib/db/schema'

export const Route = createFileRoute('/api/posts/$postId/images')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const post = await getDb().query.posts.findFirst({ where: eq(posts.id, params.postId) })
        if (!post) return Response.json({ message: 'Post not found.' }, { status: 404 })
        if (!post.isPublic && post.userId !== authUser.id) return Response.json({ message: 'Forbidden' }, { status: 403 })

        const imageId = new URL(request.url).searchParams.get('imageId')?.trim() ?? ''
        if (imageId) {
          const image = await getDb().query.postImages.findFirst({
            where: and(eq(postImages.id, imageId), eq(postImages.postId, params.postId)),
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
          .select({ id: postImages.id, mimeType: postImages.mimeType, createdAt: postImages.createdAt })
          .from(postImages)
          .where(eq(postImages.postId, params.postId))
          .orderBy(asc(postImages.createdAt))

        return Response.json(
          {
            images: rows.map((row) => ({
              id: row.id,
              mimeType: row.mimeType,
              createdAt: row.createdAt,
              src: `/api/posts/${params.postId}/images?imageId=${row.id}`,
            })),
          },
          { status: 200 },
        )
      },
    },
  },
})
