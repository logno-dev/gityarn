import { and, asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { creationImages, creations, patterns, postImages, posts, shareInboxFiles, shareInboxItems } from '#/lib/db/schema'

type CommitTarget = 'post' | 'creation' | 'pattern'

export const Route = createFileRoute('/api/share/commit')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const body = (await request.json()) as { draftId?: string; target?: CommitTarget }
        const draftId = body.draftId?.trim() ?? ''
        const target = body.target
        if (!draftId || !target) return Response.json({ message: 'draftId and target are required.' }, { status: 400 })

        const db = getDb()
        const draft = await db.query.shareInboxItems.findFirst({
          where: and(eq(shareInboxItems.id, draftId), eq(shareInboxItems.userId, authUser.id)),
        })
        if (!draft) return Response.json({ message: 'Shared draft not found.' }, { status: 404 })
        if (draft.consumedAt) {
          return Response.json({ message: 'This shared draft was already imported.' }, { status: 409 })
        }

        const files = await db
          .select({
            id: shareInboxFiles.id,
            kind: shareInboxFiles.kind,
            r2Key: shareInboxFiles.r2Key,
            mimeType: shareInboxFiles.mimeType,
            byteSize: shareInboxFiles.byteSize,
          })
          .from(shareInboxFiles)
          .where(eq(shareInboxFiles.draftId, draft.id))
          .orderBy(asc(shareInboxFiles.createdAt))

        const now = Date.now()

        if (target === 'post') {
          const postId = crypto.randomUUID()
          const postBody = buildPostBody(draft)
          await db.insert(posts).values({
            id: postId,
            userId: authUser.id,
            title: draft.title || null,
            body: postBody,
            isPublic: true,
            createdAt: now,
            updatedAt: now,
          })

          const imageRows = files
            .filter((file) => file.kind === 'image')
            .slice(0, 6)
            .map((file) => ({
              id: crypto.randomUUID(),
              postId,
              userId: authUser.id,
              r2Key: file.r2Key,
              mimeType: file.mimeType,
              byteSize: file.byteSize,
              createdAt: now,
              updatedAt: now,
            }))
          if (imageRows.length) {
            await db.insert(postImages).values(imageRows)
          }

          await markDraftConsumed(draft.id, 'post', postId, now)
          return Response.json({ message: 'Shared content imported as post.', nextPath: `/post/${postId}` }, { status: 200 })
        }

        if (target === 'creation') {
          const creationId = crypto.randomUUID()
          await db.insert(creations).values({
            id: creationId,
            userId: authUser.id,
            name: draft.title || 'Shared creation',
            status: 'active',
            isPublic: false,
            notes: buildNotes(draft),
            createdAt: now,
            updatedAt: now,
          })

          const imageRows = files
            .filter((file) => file.kind === 'image')
            .slice(0, 8)
            .map((file) => ({
              id: crypto.randomUUID(),
              creationId,
              userId: authUser.id,
              r2Key: file.r2Key,
              mimeType: file.mimeType,
              byteSize: file.byteSize,
              createdAt: now,
              updatedAt: now,
            }))
          if (imageRows.length) {
            await db.insert(creationImages).values(imageRows)
          }

          await markDraftConsumed(draft.id, 'creation', creationId, now)
          return Response.json({ message: 'Shared content imported as creation.', nextPath: '/inventory' }, { status: 200 })
        }

        if (target === 'pattern') {
          const patternId = crypto.randomUUID()
          const firstPdf = files.find((file) => file.kind === 'pdf')
          const firstImage = files.find((file) => file.kind === 'image')

          await db.insert(patterns).values({
            id: patternId,
            userId: authUser.id,
            title: draft.title || 'Shared pattern',
            description: draft.text || null,
            sourceUrl: draft.url || null,
            isPublic: false,
            publicShareConfirmed: false,
            pdfR2Key: firstPdf?.r2Key ?? null,
            pdfMimeType: firstPdf?.mimeType ?? null,
            pdfFileName: firstPdf ? 'shared-pattern.pdf' : null,
            coverR2Key: firstImage?.r2Key ?? null,
            coverMimeType: firstImage?.mimeType ?? null,
            createdAt: now,
            updatedAt: now,
          })

          await markDraftConsumed(draft.id, 'pattern', patternId, now)
          return Response.json({ message: 'Shared content imported as pattern.', nextPath: '/inventory' }, { status: 200 })
        }

        return Response.json({ message: 'Unsupported import target.' }, { status: 400 })
      },
    },
  },
})

async function markDraftConsumed(draftId: string, entityType: string, entityId: string, consumedAt: number) {
  await getDb()
    .update(shareInboxItems)
    .set({
      consumedAt,
      consumedEntityType: entityType,
      consumedEntityId: entityId,
      updatedAt: consumedAt,
    })
    .where(eq(shareInboxItems.id, draftId))
}

function buildPostBody(draft: { title: string | null; text: string | null; url: string | null }) {
  const parts = [draft.text, draft.url].filter((value): value is string => Boolean(value && value.trim()))
  const body = parts.join('\n\n').trim()
  if (body) {
    return body
  }
  return draft.title || 'Shared from Android'
}

function buildNotes(draft: { text: string | null; url: string | null }) {
  const parts = [draft.text, draft.url].filter((value): value is string => Boolean(value && value.trim()))
  return parts.length ? parts.join('\n\n') : null
}
