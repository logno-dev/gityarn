import { and, eq, gt, isNull } from 'drizzle-orm'

import { getDb } from '#/lib/db/client'
import { notifications } from '#/lib/db/schema'

export async function createNotification(input: {
  userId: string
  actorUserId?: string | null
  type: string
  entityType: string
  entityId: string
  message: string
  targetPath?: string | null
  dedupeWindowMs?: number
}) {
  const db = getDb()
  const now = Date.now()
  const dedupeWindowMs = input.dedupeWindowMs ?? 0

  if (dedupeWindowMs > 0) {
    const recent = await db.query.notifications.findFirst({
      where: and(
        eq(notifications.userId, input.userId),
        eq(notifications.type, input.type),
        eq(notifications.entityType, input.entityType),
        eq(notifications.entityId, input.entityId),
        input.actorUserId ? eq(notifications.actorUserId, input.actorUserId) : isNull(notifications.actorUserId),
        gt(notifications.createdAt, now - dedupeWindowMs),
      ),
    })

    if (recent) {
      await db
        .update(notifications)
        .set({
          message: input.message,
          targetPath: input.targetPath ?? null,
          updatedAt: now,
        })
        .where(eq(notifications.id, recent.id))
      return
    }
  }

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    actorUserId: input.actorUserId ?? null,
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    message: input.message,
    targetPath: input.targetPath ?? null,
    createdAt: now,
    updatedAt: now,
  })
}
