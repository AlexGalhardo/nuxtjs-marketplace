import { eq } from 'drizzle-orm'
import { resetPasswordSchema } from '#shared/schemas/auth'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, resetPasswordSchema.parse)

	const invalidToken = () =>
		createError({ statusCode: 400, statusMessage: 'Invalid or expired token' })

	const [record] = await db
		.select()
		.from(schema.passwordResetTokens)
		.where(eq(schema.passwordResetTokens.tokenHash, hashToken(body.token)))

	if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
		throw invalidToken()
	}

	const passwordHash = await hashPassword(body.password)
	await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, record.userId))
	await db
		.update(schema.passwordResetTokens)
		.set({ usedAt: new Date() })
		.where(eq(schema.passwordResetTokens.id, record.id))

	// The password_hash change alone invalidates every other session (server/plugins/auth-session.ts);
	// also clear this request's own cookie so the user explicitly logs back in with the new password.
	await clearUserSession(event)

	return { success: true }
})
