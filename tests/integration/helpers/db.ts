import { execFileSync } from 'node:child_process'

// Runs `body` (an async function body with `db`, `schema` and drizzle-orm's `eq`/`and`/`inArray` in
// scope) in a subprocess and returns its JSON result. Subprocess rationale: ./reset-token.ts.
export function dbQuery<T>(body: string): T {
	const script = `
    import { and, eq, inArray } from 'drizzle-orm'
    import { closeSeedClient, createSeedClient } from './server/db/client'

    const { db, schema } = await createSeedClient({ prepare: false })
    const result = await (async () => { ${body} })()
    await closeSeedClient(db)
    process.stdout.write('\\nDB_RESULT=' + JSON.stringify(result ?? null) + '\\n')
  `
	const output = execFileSync('bun', ['-e', script], { cwd: process.cwd(), encoding: 'utf-8' })
	const match = output.match(/DB_RESULT=(.*)/)
	if (!match?.[1]) throw new Error(`dbQuery produced no result:\n${output}`)
	return JSON.parse(match[1]) as T
}
