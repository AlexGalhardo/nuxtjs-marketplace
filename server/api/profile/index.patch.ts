import { eq } from 'drizzle-orm'
import { updateProfileSchema } from '#shared/schemas/profile'

export default defineEventHandler(async (event) => {
	const sessionUser = await requireUser(event)
	const body = await readValidatedBody(event, updateProfileSchema.parse)

	const [user] = await db
		.update(schema.users)
		.set({ name: body.name, phone: body.phone ?? null })
		.where(eq(schema.users.id, sessionUser.id))
		.returning()
	if (!user) {
		throw createError({ statusCode: 404, statusMessage: 'User not found' })
	}

	await createUserSession(event, user)

	return { user: toSafeUser(user), phone: user.phone }
})
