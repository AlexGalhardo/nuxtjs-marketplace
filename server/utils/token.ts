import { createHash, randomBytes } from 'node:crypto'

// Used for password reset tokens and API tokens: the random value is emailed/shown once, only
// its SHA-256 hash is stored (docs/authentication.md, D14).
export function generateToken(bytes = 32): string {
	return randomBytes(bytes).toString('hex')
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex')
}
