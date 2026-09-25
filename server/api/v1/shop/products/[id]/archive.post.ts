import { eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['products'],
		summary: 'Unpublish (archive) a product',
	},
})

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
	}

	const { product } = await requireProductOwner(event, id)
	if (product.status === 'suspended') {
		throw createError({
			statusCode: 409,
			statusMessage: 'This product was suspended by a moderator. Contact support',
		})
	}

	const [updated] = await db
		.update(schema.products)
		.set({ status: 'archived' })
		.where(eq(schema.products.id, product.id))
		.returning()

	return updated
})
