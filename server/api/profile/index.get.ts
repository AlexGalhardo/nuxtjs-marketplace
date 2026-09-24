import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, sessionUser.id))
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return { user: toSafeUser(user), phone: user.phone }
})
