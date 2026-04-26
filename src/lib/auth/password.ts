import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `v1$${salt}$${hash}`
}

export function verifyPassword(password: string, storedHash: string) {
  const [version, salt, hash] = storedHash.split('$')
  if (version !== 'v1' || !salt || !hash) {
    return false
  }

  const suppliedHash = scryptSync(password, salt, KEY_LENGTH)
  const storedBuffer = Buffer.from(hash, 'hex')

  if (suppliedHash.byteLength !== storedBuffer.byteLength) {
    return false
  }

  return timingSafeEqual(suppliedHash, storedBuffer)
}
