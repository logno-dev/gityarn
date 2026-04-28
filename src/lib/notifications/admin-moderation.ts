import { Resend } from 'resend'

import { getServerEnv } from '#/lib/env'

type AlertInput = {
  kind: 'flag' | 'report' | 'claim' | 'correction'
  actor: {
    id: string
    displayName?: string | null
    email?: string | null
  }
  entity: {
    type: string
    id: string
  }
  reason?: string | null
  details?: string | null
  sourcePath?: string
}

export async function sendAdminModerationAlert(input: AlertInput) {
  const env = getServerEnv()
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.ADMIN_EMAILS) {
    return
  }

  const adminRecipients = env.ADMIN_EMAILS.split(',').map((entry) => entry.trim()).filter(Boolean)
  if (!adminRecipients.length) {
    return
  }

  const actorLabel = input.actor.displayName || input.actor.email || input.actor.id
  const origin = env.APP_BASE_URL ?? 'https://app'
  const reviewUrl = `${origin}/admin`
  const sourceUrl = input.sourcePath ? `${origin}${input.sourcePath}` : null

  const subject = `[GIT Yarn] New moderation ${input.kind}`
  const lines = [
    `A new moderation ${input.kind} was submitted.`,
    '',
    `Actor: ${actorLabel} (${input.actor.id})`,
    `Entity: ${input.entity.type} (${input.entity.id})`,
    input.reason ? `Reason: ${input.reason}` : null,
    input.details ? `Details: ${input.details}` : null,
    sourceUrl ? `Source: ${sourceUrl}` : null,
    '',
    `Review queue: ${reviewUrl}`,
  ].filter((line): line is string => Boolean(line))

  const resend = new Resend(env.RESEND_API_KEY)
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: adminRecipients,
    subject,
    text: lines.join('\n'),
  })
}
