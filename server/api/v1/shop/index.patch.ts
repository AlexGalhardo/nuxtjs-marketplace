import { eq } from 'drizzle-orm'
import { shopUpdateSchema } from '#shared/schemas/shop'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, shopUpdateSchema.parse)

  const [shop] = await db
    .update(schema.shops)
    .set({ name: body.name, description: body.description ?? null })
    .where(eq(schema.shops.ownerId, user.id))
    .returning()
  if (!shop) {
    throw createError({ statusCode: 404, statusMessage: 'Shop not found' })
  }

  return shop
})
