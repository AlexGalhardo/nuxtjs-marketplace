import { eq } from 'drizzle-orm'
import { signupSchema } from '#shared/schemas/auth'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, signupSchema.parse)

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, body.email))
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An account with this email already exists',
    })
  }

  const passwordHash = await hashPassword(body.password)
  const [user] = await db
    .insert(schema.users)
    .values({ name: body.name, email: body.email, passwordHash })
    .returning()
  if (!user) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create account' })
  }

  await createUserSession(event, user)

  return { user: toSafeUser(user) }
})
