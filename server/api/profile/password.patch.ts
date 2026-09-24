import { eq } from 'drizzle-orm'
import { changePasswordSchema } from '#shared/schemas/profile'

export default defineEventHandler(async (event) => {
	const sessionUser = await requireUser(event)
	const body = await readValidatedBody(event, changePasswordSchema.parse)

	const [user] = await db.select().from(schema.users).where(eq(schema.users.id, sessionUser.id))
	if (!user) {
		throw createError({ statusCode: 404, statusMessage: 'User not found' })
	}

	const valid = await verifyPassword(user.passwordHash, body.currentPassword)
	if (!valid) {
		throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })
	}

	const passwordHash = await hashPassword(body.newPassword)
	await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, user.id))

	// Every other session (including this one's cookie) is now stale (server/plugins/auth-session.ts).
	await clearUserSession(event)

	return { success: true }
})
