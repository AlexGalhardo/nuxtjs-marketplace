import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, user.id))

  return shop ?? null
})
