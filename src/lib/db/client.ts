import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import { getDbEnv } from '../env'
import * as schema from './schema'

type DatabaseClient = ReturnType<typeof drizzle<typeof schema>>

let database: DatabaseClient | null = null

export function getDb() {
  if (database) {
    return database
  }

  const env = getDbEnv()
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  })

  database = drizzle(client, { schema })
  return database
}
