import { and, eq } from 'drizzle-orm'
import { addressSchema } from '#shared/schemas/address'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing address id' })
  }
  const body = await readValidatedBody(event, addressSchema.parse)

  const [existing] = await db
    .select()
    .from(schema.addresses)
    .where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, user.id)))
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Address not found' })
  }

  if (body.isDefault) {
    await db
      .update(schema.addresses)
      .set({ isDefault: false })
      .where(eq(schema.addresses.userId, user.id))
  }

  const [address] = await db
    .update(schema.addresses)
    .set(body)
    .where(eq(schema.addresses.id, id))
    .returning()

  return address
})
