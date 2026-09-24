import { eq, or } from 'drizzle-orm'
import { shopSchema } from '#shared/schemas/shop'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, shopSchema.parse)

  const [existing] = await db
    .select()
    .from(schema.shops)
    .where(or(eq(schema.shops.ownerId, user.id), eq(schema.shops.slug, body.slug)))
  if (existing?.ownerId === user.id) {
    throw createError({ statusCode: 409, statusMessage: 'You already have a shop' })
  }
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'This shop URL is already taken' })
  }

  const [shop] = await db
    .insert(schema.shops)
    .values({
      ownerId: user.id,
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
    })
    .returning()

  return shop
})
