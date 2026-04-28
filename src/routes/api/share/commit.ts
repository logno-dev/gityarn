import { and, asc, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedUser } from '#/lib/auth/service'
import { getDb } from '#/lib/db/client'
import { creationImages, creations, patterns, postImages, posts, shareInboxFiles, shareInboxItems } from '#/lib/db/schema'

type CommitTarget = 'post' | 'creation' | 'pattern'
type CreationMode = 'new' | 'existing'

export const Route = createFileRoute('/api/share/commit')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getAuthenticatedUser(request.headers.get('cookie'))
        if (!authUser) return Response.json({ message: 'Unauthorized' }, { status: 401 })

        const body = (await request.json()) as {
          draftId?: string
          target?: CommitTarget
          postTitle?: string
          postBody?: string
          patternTitle?: string
          patternDescription?: string
          patternSourceUrl?: string
          patternNotes?: string
          creationMode?: CreationMode
          existingCreationId?: string
          creationName?: string
          creationStatus?: string
          creationNotes?: string
        }
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
          const postTitle = body.postTitle?.trim() || null
          const postBody = body.postBody?.trim() ?? ''
          if (!postBody) {
            return Response.json({ message: 'Post body is required.' }, { status: 400 })
          }
          if (postBody.length > 5000) {
            return Response.json({ message: 'Post body must be 5000 characters or less.' }, { status: 400 })
          }

          const postId = crypto.randomUUID()
          await db.insert(posts).values({
            id: postId,
            userId: authUser.id,
            title: postTitle,
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
          const imageRows = files.filter((file) => file.kind === 'image').slice(0, 8)
          if (!imageRows.length) {
            return Response.json({ message: 'Creation import requires at least one shared image.' }, { status: 400 })
          }

          const creationMode = body.creationMode === 'existing' ? 'existing' : 'new'

          if (creationMode === 'existing') {
            const creationId = body.existingCreationId?.trim() ?? ''
            if (!creationId) {
              return Response.json({ message: 'Choose an existing creation.' }, { status: 400 })
            }

            const existing = await db.query.creations.findFirst({ where: and(eq(creations.id, creationId), eq(creations.userId, authUser.id)) })
            if (!existing) {
              return Response.json({ message: 'Creation not found.' }, { status: 404 })
            }

            await db.insert(creationImages).values(
              imageRows.map((file) => ({
                id: crypto.randomUUID(),
                creationId,
                userId: authUser.id,
                r2Key: file.r2Key,
                mimeType: file.mimeType,
                byteSize: file.byteSize,
                createdAt: now,
                updatedAt: now,
              })),
            )
            await db.update(creations).set({ updatedAt: now }).where(eq(creations.id, creationId))

            await markDraftConsumed(draft.id, 'creation', creationId, now)
            return Response.json({ message: 'Shared images added to existing creation.', nextPath: '/inventory' }, { status: 200 })
          }

          const creationId = crypto.randomUUID()
          const creationName = body.creationName?.trim() || draft.title || 'Shared creation'
          const creationStatus = normalizeCreationStatus(body.creationStatus)
          const creationNotes = body.creationNotes?.trim() || null

          await db.insert(creations).values({
            id: creationId,
            userId: authUser.id,
            name: creationName,
            status: creationStatus,
            isPublic: false,
            notes: creationNotes,
            createdAt: now,
            updatedAt: now,
          })

          await db.insert(creationImages).values(
            imageRows.map((file) => ({
              id: crypto.randomUUID(),
              creationId,
              userId: authUser.id,
              r2Key: file.r2Key,
              mimeType: file.mimeType,
              byteSize: file.byteSize,
              createdAt: now,
              updatedAt: now,
            })),
          )

          await markDraftConsumed(draft.id, 'creation', creationId, now)
          return Response.json({ message: 'Shared content imported as new creation.', nextPath: '/inventory' }, { status: 200 })
        }

        if (target === 'pattern') {
          const patternTitle = body.patternTitle?.trim() || draft.title || 'Shared pattern'
          const patternDescription = body.patternDescription?.trim() || null
          const patternSourceUrl = body.patternSourceUrl?.trim() || null
          const patternNotes = body.patternNotes?.trim() || null

          const patternId = crypto.randomUUID()
          const firstPdf = files.find((file) => file.kind === 'pdf')
          const firstImage = files.find((file) => file.kind === 'image')

          await db.insert(patterns).values({
            id: patternId,
            userId: authUser.id,
            title: patternTitle,
            description: patternDescription,
            sourceUrl: patternSourceUrl,
            isPublic: false,
            publicShareConfirmed: false,
            pdfR2Key: firstPdf?.r2Key ?? null,
            pdfMimeType: firstPdf?.mimeType ?? null,
            pdfFileName: firstPdf ? 'shared-pattern.pdf' : null,
            coverR2Key: firstImage?.r2Key ?? null,
            coverMimeType: firstImage?.mimeType ?? null,
            notes: patternNotes,
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

function normalizeCreationStatus(value: string | undefined) {
  if (value === 'paused') return 'paused'
  if (value === 'finished') return 'finished'
  return 'active'
}
