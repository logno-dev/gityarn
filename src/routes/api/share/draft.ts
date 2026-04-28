import { and, asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { shareInboxFiles, shareInboxItems } from '#/lib/db/schema'

export const Route = createFileRoute('/api/share/draft')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const draftId = new URL(request.url).searchParams.get('draftId')?.trim() ?? ''
        if (!draftId) return Response.json({ message: 'draftId is required.' }, { status: 400 })

        const draft = await getDb().query.shareInboxItems.findFirst({
          where: and(eq(shareInboxItems.id, draftId), eq(shareInboxItems.userId, authUser.id)),
        })
        if (!draft) return Response.json({ message: 'Shared draft not found.' }, { status: 404 })

        const files = await getDb()
          .select({
            id: shareInboxFiles.id,
            kind: shareInboxFiles.kind,
            originalFileName: shareInboxFiles.originalFileName,
            mimeType: shareInboxFiles.mimeType,
            byteSize: shareInboxFiles.byteSize,
          })
          .from(shareInboxFiles)
          .where(eq(shareInboxFiles.draftId, draft.id))
          .orderBy(asc(shareInboxFiles.createdAt))

        return Response.json(
          {
            draft: {
              id: draft.id,
              title: draft.title,
              text: draft.text,
              url: draft.url,
              consumedAt: draft.consumedAt,
              files: files.map((file) => ({
                ...file,
                src: `/api/share/files/${file.id}`,
              })),
            },
          },
          { status: 200 },
        )
      },
    },
  },
})
