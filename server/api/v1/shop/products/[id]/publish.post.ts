import { eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['products'],
		summary: 'Publish a product',
		description: '409 until your shop finished Stripe onboarding (`chargesEnabled`).',
	},
})

// D12: publishing requires completed Stripe onboarding (shop.chargesEnabled).
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
	}

	const { product, shop } = await requireProductOwner(event, id)
	if (product.status === 'suspended') {
		throw createError({
			statusCode: 409,
			statusMessage: 'This product was suspended by a moderator. Contact support',
		})
	}
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
