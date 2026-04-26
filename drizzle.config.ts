import { defineConfig } from 'drizzle-kit'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const env = {
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
}

if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
  const envPath = path.resolve(process.cwd(), '.env')
  if (existsSync(envPath)) {
    const file = readFileSync(envPath, 'utf-8')
    for (const rawLine of file.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) {
        continue
      }
      const equalIndex = line.indexOf('=')
      if (equalIndex < 0) {
        continue
      }
      const key = line.slice(0, equalIndex).trim()
      const value = line.slice(equalIndex + 1).trim().replace(/^['\"]|['\"]$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoToken = process.env.TURSO_AUTH_TOKEN

if (!tursoUrl || !tursoToken) {
  throw new Error(
    'Missing Turso credentials. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your shell or .env before running drizzle-kit.',
  )
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: tursoUrl,
    authToken: tursoToken,
  },
})
