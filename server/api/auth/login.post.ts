import { eq } from 'drizzle-orm'
import { loginSchema } from '#shared/schemas/auth'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, loginSchema.parse)

	// Generic message either way: no user enumeration (docs/authentication.md, OWASP A07).
	const invalidCredentials = () =>
		createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

	const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email))
	if (!user) {
		logSecurityEvent(event, 'login.failed', { userId: null, reason: 'unknown_email' })
		throw invalidCredentials()
	}

	const valid = await verifyPassword(user.passwordHash, body.password)
	if (!valid) {
		logSecurityEvent(event, 'login.failed', { userId: user.id, reason: 'bad_password' })
		throw invalidCredentials()
	}

	await createUserSession(event, user)
	logSecurityEvent(event, 'login.succeeded', { userId: user.id })

	return { user: toSafeUser(user) }
})
