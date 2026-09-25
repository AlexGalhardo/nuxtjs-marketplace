// Used by standalone Bun scripts (server/db/seed.ts) that run outside the Nitro build, so they
// cannot rely on the `db`/`schema` auto-imports. Mirrors what `nuxt db migrate`/`generate` do
// internally: refresh `.nuxt/hub/db/config.json` via `nuxt prepare`, then build a Drizzle client
// from it with the same public `@nuxthub/core/db` API the NuxtHub CLI itself uses.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createDrizzleClient } from '@nuxthub/core/db'
import * as postgresqlSchema from './schema.postgresql'
import * as sqliteSchema from './schema.sqlite'

export type SeedDialect = 'sqlite' | 'postgresql'

// Test helpers pass `prepare: false` to reuse an existing config: parallel test workers running
// `nuxt prepare` at the same time collide on `.nuxt` (and it costs seconds per call).
export async function createSeedClient({ prepare = true }: { prepare?: boolean } = {}) {
	const configPath = join(process.cwd(), '.nuxt/hub/db/config.json')
	if (prepare || !existsSync(configPath)) {
		execSync('bunx nuxt prepare', { stdio: 'inherit', cwd: process.cwd() })
	}

	const hubConfig = JSON.parse(await readFile(configPath, 'utf-8'))
	const dialect = hubConfig.db.dialect as SeedDialect
	const db = await createDrizzleClient(hubConfig.db, hubConfig.dir)
	const schema = dialect === 'postgresql' ? postgresqlSchema : sqliteSchema

	return { db, dialect, schema }
}

export async function closeSeedClient(db: Awaited<ReturnType<typeof createDrizzleClient>>) {
	// postgres-js exposes `end()`; the libsql client (sqlite) only has `close()`. Closing properly
	// matters here: unlike a short-lived CLI process (where process exit releases the file lock
	// regardless), this is called from long-lived processes (tests) where a leaked libsql
	// connection keeps a lock on the sqlite file for the rest of the run.
	const client = db.$client as { end?: () => Promise<void>; close?: () => void } | undefined
	if (typeof client?.end === 'function') {
		await client.end()
	} else if (typeof client?.close === 'function') {
		client.close()
	}
}
