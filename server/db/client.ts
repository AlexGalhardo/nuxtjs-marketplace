// Used by standalone Bun scripts (server/db/seed.ts) that run outside the Nitro build, so they
// cannot rely on the `db`/`schema` auto-imports. Mirrors what `nuxt db migrate`/`generate` do
// internally: refresh `.nuxt/hub/db/config.json` via `nuxt prepare`, then build a Drizzle client
// from it with the same public `@nuxthub/core/db` API the NuxtHub CLI itself uses.
import { execSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createDrizzleClient } from '@nuxthub/core/db'
import * as postgresqlSchema from './schema.postgresql'
import * as sqliteSchema from './schema.sqlite'

export type SeedDialect = 'sqlite' | 'postgresql'

export async function createSeedClient() {
  execSync('bunx nuxt prepare', { stdio: 'inherit', cwd: process.cwd() })

  const configPath = join(process.cwd(), '.nuxt/hub/db/config.json')
  const hubConfig = JSON.parse(await readFile(configPath, 'utf-8'))
  const dialect = hubConfig.db.dialect as SeedDialect
  const db = await createDrizzleClient(hubConfig.db, hubConfig.dir)
  const schema = dialect === 'postgresql' ? postgresqlSchema : sqliteSchema

  return { db, dialect, schema }
}

export async function closeSeedClient(db: Awaited<ReturnType<typeof createDrizzleClient>>) {
  await db.$client?.end?.()
}
