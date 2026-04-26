import { createHash, randomBytes } from 'node:crypto'

import { getServerEnv } from '../env'

export const SESSION_COOKIE_NAME = 'gityarn_session'
const SESSION_LENGTH_DAYS = 30

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function tokenToHash(token: string) {
  const env = getServerEnv()
  return createHash('sha256').update(`${env.SESSION_SECRET}:${token}`).digest('hex')
}

export function getSessionExpiryTimestamp() {
  return Date.now() + SESSION_LENGTH_DAYS * 24 * 60 * 60 * 1000
}

export function parseCookie(cookieHeader: string | null, key: string) {
  if (!cookieHeader) {
    return null
  }

  const value = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`))
    ?.slice(key.length + 1)

  return value ?? null
}

export function sessionCookieValue(token: string, expiresAt: number) {
  const isSecure = getServerEnv().NODE_ENV === 'production'
  const expires = new Date(expiresAt).toUTCString()
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}${isSecure ? '; Secure' : ''}`
}

export function clearSessionCookieValue() {
  const isSecure = getServerEnv().NODE_ENV === 'production'
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${isSecure ? '; Secure' : ''}`
}
