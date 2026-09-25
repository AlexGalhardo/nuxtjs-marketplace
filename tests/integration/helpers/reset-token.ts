import { generateToken, hashToken } from '../../../server/utils/token'
import { dbQuery } from './db'

// Issuing the token via createSeedClient() in-process (inside the long-lived vitest worker) is
// unreliable on Windows: the libsql/sqlite driver's file handle isn't always released in time
// for the server (a separate process) to safely read/write the same file right after, causing an
// intermittent 500 on the very next request. dbQuery runs it as a subprocess that fully exits
// before we return (and retries while a parallel writer holds the SQLite lock).
export function issueResetToken(userId: string): string {
	const rawToken = generateToken()
	dbQuery(`
    await db.insert(schema.passwordResetTokens).values({
      userId: ${JSON.stringify(userId)},
      tokenHash: ${JSON.stringify(hashToken(rawToken))},
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
  `)
	return rawToken
}
