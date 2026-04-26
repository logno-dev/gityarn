import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { assetFiles } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 5 * 1024 * 1024

export const Route = createFileRoute('/api/account-settings/avatar')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const latestAvatar = await db.query.assetFiles.findFirst({
          where: and(eq(assetFiles.userId, authUser.id), eq(assetFiles.kind, 'profile-avatar')),
          orderBy: (table, { desc }) => [desc(table.updatedAt)],
        })

        if (!latestAvatar) {
          return Response.json({ message: 'Avatar not found.' }, { status: 404 })
        }

        const env = getServerEnv()
        const result = await getR2Client().send(
          new GetObjectCommand({
            Bucket: env.R2_BUCKET,
            Key: latestAvatar.r2Key,
          }),
        )

        const bytes = await result.Body?.transformToByteArray()
        if (!bytes) {
          return Response.json({ message: 'Avatar data unavailable.' }, { status: 404 })
        }

        const safeBytes = new Uint8Array(bytes.byteLength)
        safeBytes.set(bytes)

        return new Response(new Blob([safeBytes], { type: latestAvatar.mimeType ?? 'application/octet-stream' }), {
          status: 200,
          headers: {
            'Content-Type': latestAvatar.mimeType ?? 'application/octet-stream',
            'Cache-Control': 'private, max-age=300',
          },
        })
      },
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file')
        if (!(file instanceof File)) {
          return Response.json({ message: 'File is required.' }, { status: 400 })
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
          return Response.json({ message: 'Only JPG, PNG, WEBP, or GIF files are allowed.' }, { status: 400 })
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ message: 'File must be 5MB or smaller.' }, { status: 400 })
        }

        const extension = mimeToExtension(file.type)
        const key = `users/${authUser.id}/avatar/${crypto.randomUUID()}.${extension}`
        const body = new Uint8Array(await file.arrayBuffer())
        const env = getServerEnv()
        const db = getDb()

        const previousAvatars = await db
          .select({ id: assetFiles.id, r2Key: assetFiles.r2Key })
          .from(assetFiles)
          .where(and(eq(assetFiles.userId, authUser.id), eq(assetFiles.kind, 'profile-avatar')))

        await getR2Client().send(
          new PutObjectCommand({
            Bucket: env.R2_BUCKET,
            Key: key,
            Body: body,
            ContentType: file.type,
          }),
        )

        for (const row of previousAvatars) {
          await getR2Client().send(
            new DeleteObjectCommand({
              Bucket: env.R2_BUCKET,
              Key: row.r2Key,
            }),
          )
        }

        await db
          .delete(assetFiles)
          .where(and(eq(assetFiles.userId, authUser.id), eq(assetFiles.kind, 'profile-avatar')))

        const now = Date.now()
        await db.insert(assetFiles).values({
          id: crypto.randomUUID(),
          userId: authUser.id,
          kind: 'profile-avatar',
          r2Key: key,
          mimeType: file.type,
          byteSize: file.size,
          createdAt: now,
          updatedAt: now,
        })

        return Response.json({ message: 'Profile photo updated.', avatarUpdatedAt: now }, { status: 200 })
      },
    },
  },
})

function mimeToExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/gif') return 'gif'
  return 'webp'
}
