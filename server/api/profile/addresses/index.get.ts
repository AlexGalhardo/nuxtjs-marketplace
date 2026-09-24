import { desc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  return db
    .select()
    .from(schema.addresses)
    .where(eq(schema.addresses.userId, user.id))
    .orderBy(desc(schema.addresses.isDefault), desc(schema.addresses.createdAt))
})
