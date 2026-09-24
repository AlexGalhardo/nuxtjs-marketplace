import { execFileSync } from 'node:child_process'

// Issuing the token via createSeedClient() in-process (inside the long-lived vitest worker) is
// unreliable on Windows: the libsql/sqlite driver's file handle isn't always released in time
// for the server (a separate process) to safely read/write the same file right after, causing an
// intermittent 500 on the very next request. Running it as a genuine subprocess that fully exits
// before we return avoids the race (matches how a real Nitro CLI invocation behaves).
export function issueResetToken(userId: string): string {
	const script = `
    import { closeSeedClient, createSeedClient } from './server/db/client'
    import { generateToken, hashToken } from './server/utils/token'

    const rawToken = generateToken()
    const { db, schema } = await createSeedClient()
    await db.insert(schema.passwordResetTokens).values({
      userId: ${JSON.stringify(userId)},
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    await closeSeedClient(db)
    process.stdout.write('\\nRESET_TOKEN=' + rawToken + '\\n')
  `

	const output = execFileSync('bun', ['-e', script], { cwd: process.cwd(), encoding: 'utf-8' })
	const match = output.match(/RESET_TOKEN=([0-9a-f]+)/)
	if (!match?.[1]) {
		throw new Error(`Failed to extract reset token from subprocess output:\n${output}`)
	}
	return match[1]
}
