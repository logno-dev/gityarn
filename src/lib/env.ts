import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

const dbEnvSchema = z.object({
  TURSO_DATABASE_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().min(1),
})

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SESSION_SECRET: z.string().min(16),
  ...dbEnvSchema.shape,
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  ADMIN_EMAILS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  APP_BASE_URL: z.string().url().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>
export type DbEnv = z.infer<typeof dbEnvSchema>

let cachedEnv: ServerEnv | null = null
let cachedDbEnv: DbEnv | null = null
let dotenvLoaded = false

function loadDotEnvIfPresent() {
  if (dotenvLoaded) {
    return
  }

  dotenvLoaded = true
  const envPath = path.resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    return
  }

  const content = readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const equalsIndex = line.indexOf('=')
    if (equalsIndex < 0) {
      continue
    }

    const key = line.slice(0, equalsIndex).trim()
    const value = line.slice(equalsIndex + 1).trim().replace(/^['\"]|['\"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

export function getDbEnv(): DbEnv {
  if (cachedDbEnv) {
    return cachedDbEnv
  }

  loadDotEnvIfPresent()
  const parsed = dbEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid database environment variables: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`)
  }

  cachedDbEnv = parsed.data
  return cachedDbEnv
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  loadDotEnvIfPresent()
  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`)
  }

  cachedEnv = parsed.data
  return cachedEnv
}
