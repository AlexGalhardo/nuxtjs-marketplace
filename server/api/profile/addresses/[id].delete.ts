import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing address id' })
  }

  const [existing] = await db
    .select()
    .from(schema.addresses)
    .where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, user.id)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Address not found' })
  }

  await db.delete(schema.addresses).where(eq(schema.addresses.id, id))

  return { success: true }
})
