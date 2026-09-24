import { eq } from 'drizzle-orm'
import { loginSchema } from '#shared/schemas/auth'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, loginSchema.parse)

	// Generic message either way: no user enumeration (docs/authentication.md, OWASP A07).
	const invalidCredentials = () =>
		createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

	const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email))
	if (!user) {
		throw invalidCredentials()
	}

	const valid = await verifyPassword(user.passwordHash, body.password)
	if (!valid) {
		throw invalidCredentials()
	}

	await createUserSession(event, user)

	return { user: toSafeUser(user) }
})
