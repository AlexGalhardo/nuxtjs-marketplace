import { eq } from 'drizzle-orm'

// D12: publishing requires completed Stripe onboarding (shop.chargesEnabled).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  }

  const { product, shop } = await requireProductOwner(event, id)
  if (!shop.chargesEnabled) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Finish connecting your Stripe account before publishing products',
    })
  }

  const [updated] = await db
    .update(schema.products)
    .set({ status: 'published' })
    .where(eq(schema.products.id, product.id))
    .returning()

  return updated
})
