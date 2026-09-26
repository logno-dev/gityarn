import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { patterns, patternFileVariants } from '#/lib/db/schema'
import { getServerEnv } from '#/lib/env'
import { getR2Client } from '#/lib/r2/client'

export const Route = createFileRoute('/api/patterns/$patternId/discard-upload')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })
        const body = await request.json().catch(() => null) as { key?: string } | null
        const key = body?.key?.trim() ?? ''
        if (!key || !key.startsWith(`users/${authUser.id}/patterns/${params.patternId}/`)) return Response.json({ message: 'Upload key is invalid.' }, { status: 400 })

        const pattern = await getDb().query.patterns.findFirst({ where: and(eq(patterns.id, params.patternId), eq(patterns.userId, authUser.id)) })
        if (!pattern) {
          await getR2Client().send(new DeleteObjectCommand({ Bucket: getServerEnv().R2_BUCKET, Key: key }))
          return Response.json({ message: 'Unused upload removed.', discarded: true })
        }

        const variant = await getDb().query.patternFileVariants.findFirst({ where: and(eq(patternFileVariants.patternId, pattern.id), eq(patternFileVariants.r2Key, key)) })
        const isAttached = variant || [pattern.pdfR2Key, pattern.pdfPreviewR2Key, pattern.coverR2Key].includes(key)
        if (isAttached) return Response.json({ message: 'Upload is already attached.', discarded: false })

        await getR2Client().send(new DeleteObjectCommand({ Bucket: getServerEnv().R2_BUCKET, Key: key }))
        return Response.json({ message: 'Unused upload removed.', discarded: true })
      },
    },
  },
})
