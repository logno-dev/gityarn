import { PutObjectCommand } from '@aws-sdk/client-s3'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'
import { postImages, posts, users } from '#/lib/db/schema'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const Route = createFileRoute('/api/posts')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const url = new URL(request.url)
        const query = (url.searchParams.get('query') ?? '').trim().toLowerCase()
        const mineOnly = (url.searchParams.get('mine') ?? '').trim() === '1'
        const whereClause = query
          ? and(
              ...(mineOnly ? [eq(posts.userId, authUser.id)] : [eq(posts.isPublic, true), eq(posts.moderationStatus, 'active')]),
              sql`(
                lower(coalesce(${posts.title}, '')) like ${`%${query}%`}
                or lower(${posts.body}) like ${`%${query}%`}
                or lower(${users.displayName}) like ${`%${query}%`}
              )`,
            )
          : mineOnly
            ? eq(posts.userId, authUser.id)
            : and(eq(posts.isPublic, true), eq(posts.moderationStatus, 'active'))

        const rows = await getDb()
          .select({
            id: posts.id,
            title: posts.title,
            body: posts.body,
            ownerDisplayName: users.displayName,
            isPublic: posts.isPublic,
            moderationStatus: posts.moderationStatus,
            moderationReason: posts.moderationReason,
            updatedAt: posts.updatedAt,
          })
          .from(posts)
          .innerJoin(users, eq(posts.userId, users.id))
          .where(whereClause)
          .orderBy(desc(posts.updatedAt))
          .limit(200)

        const postIds = rows.map((row) => row.id)
        const images = postIds.length
          ? await getDb()
              .select({ postId: postImages.postId, imageId: postImages.id })
              .from(postImages)
              .where(inArray(postImages.postId, postIds))
              .orderBy(desc(postImages.createdAt))
          : []

        const firstImageByPostId = new Map<string, string>()
        for (const image of images) {
          if (!firstImageByPostId.has(image.postId)) {
            firstImageByPostId.set(image.postId, image.imageId)
          }
        }

        return Response.json(
          {
            posts: rows.map((row) => ({
              ...row,
              previewImage: firstImageByPostId.has(row.id)
                ? `/api/posts/${row.id}/images?imageId=${firstImageByPostId.get(row.id)}`
                : null,
            })),
          },
          { status: 200 },
        )
      },
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const formData = await request.formData()
        const text = (formData.get('body') ?? '').toString().trim()
        const title = (formData.get('title') ?? '').toString().trim() || null
        const files = formData.getAll('files').filter((value): value is File => value instanceof File).slice(0, 6)

        if (!text) return Response.json({ message: 'Post body is required.' }, { status: 400 })
        if (text.length > 5000) return Response.json({ message: 'Post body must be 5000 characters or less.' }, { status: 400 })

        const now = Date.now()
        const postId = crypto.randomUUID()
        await getDb().insert(posts).values({
          id: postId,
          userId: authUser.id,
          title,
          body: text,
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        })

        const env = getServerEnv()
        const imageRows: Array<typeof postImages.$inferInsert> = []
        for (const file of files) {
          if (!IMAGE_MIME_TYPES.has(file.type)) {
            return Response.json({ message: 'Post images must be JPG, PNG, WEBP, or GIF.' }, { status: 400 })
          }
          if (file.size > MAX_IMAGE_BYTES) {
            return Response.json({ message: 'Each post image must be 8MB or smaller.' }, { status: 400 })
          }
          const ext = mimeToImageExt(file.type)
          const key = `users/${authUser.id}/posts/${postId}/${crypto.randomUUID()}.${ext}`
          await getR2Client().send(
            new PutObjectCommand({
              Bucket: env.R2_BUCKET,
              Key: key,
              Body: new Uint8Array(await file.arrayBuffer()),
              ContentType: file.type,
            }),
          )
          imageRows.push({
            id: crypto.randomUUID(),
            postId,
            userId: authUser.id,
            r2Key: key,
            mimeType: file.type,
            byteSize: file.size,
            createdAt: now,
            updatedAt: now,
          })
        }

        if (imageRows.length) {
          await getDb().insert(postImages).values(imageRows)
        }

        return Response.json({ message: 'Post published.' }, { status: 201 })
      },
      DELETE: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const body = (await request.json()) as { postId?: string }
        const postId = body.postId?.trim() ?? ''
        if (!postId) {
          return Response.json({ message: 'postId is required.' }, { status: 400 })
        }

        const existing = await getDb().query.posts.findFirst({ where: eq(posts.id, postId) })
        if (!existing) {
          return Response.json({ message: 'Post not found.' }, { status: 404 })
        }
        if (existing.userId !== authUser.id) {
          return Response.json({ message: 'Forbidden' }, { status: 403 })
        }

        await getDb().delete(posts).where(eq(posts.id, postId))
        return Response.json({ message: 'Post removed.' }, { status: 200 })
      },
    },
  },
})

function mimeToImageExt(mimeType: string) {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}
