import { and, eq, gt } from 'drizzle-orm'

import { getDb } from '../db/client'
import { sessions, users } from '../db/schema'
import { getServerEnv } from '../env'
import { hashPassword, verifyPassword } from './password'
import { createSessionToken, getSessionExpiryTimestamp, parseCookie, tokenToHash, SESSION_COOKIE_NAME } from './session'

type AuthUser = {
  id: string
  email: string
  displayName: string
  role: 'member' | 'admin'
}

export async function signUpWithPassword(input: { displayName: string; email: string; password: string }) {
  const db = getDb()
  const normalizedEmail = input.email.trim().toLowerCase()
  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) })

  if (existing) {
    throw new Error('Email is already registered.')
  }

  const user: typeof users.$inferInsert = {
    id: crypto.randomUUID(),
    displayName: input.displayName.trim(),
    email: normalizedEmail,
    role: isAdminEmail(normalizedEmail) ? 'admin' : 'member',
    passwordHash: hashPassword(input.password),
  }

  await db.insert(users).values(user)

  const { sessionToken, sessionExpiresAt } = await createSessionForUser(user.id)

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as AuthUser['role'],
    },
    sessionToken,
    sessionExpiresAt,
  }
}

export async function signInWithPassword(input: { email: string; password: string }) {
  const db = getDb()
  const normalizedEmail = input.email.trim().toLowerCase()
  const user = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) })

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new Error('Invalid email/password combination.')
  }

  const { sessionToken, sessionExpiresAt } = await createSessionForUser(user.id)

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as AuthUser['role'],
    },
    sessionToken,
    sessionExpiresAt,
  }
}

export async function signOut(sessionToken: string | null) {
  if (!sessionToken) {
    return
  }

  const db = getDb()
  const tokenHash = tokenToHash(sessionToken)

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
}

export async function getAuthenticatedUser(cookieHeader: string | null): Promise<AuthUser | null> {
  const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE_NAME)
  if (!sessionToken) {
    return null
  }

  const db = getDb()
  const now = Date.now()
  const tokenHash = tokenToHash(sessionToken)

  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)),
  })

  if (!session) {
    return null
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
  if (!user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role as AuthUser['role'],
  }
}

function isAdminEmail(email: string) {
  const env = getServerEnv()
  const adminEmails = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return adminEmails.includes(email)
}

async function createSessionForUser(userId: string) {
  const db = getDb()
  const sessionToken = createSessionToken()
  const sessionExpiresAt = getSessionExpiryTimestamp()

  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: tokenToHash(sessionToken),
    expiresAt: sessionExpiresAt,
  })

  return { sessionToken, sessionExpiresAt }
}
