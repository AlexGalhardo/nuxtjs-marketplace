import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
	}

	const { product } = await requireProductOwner(event, id)

	const [updated] = await db
		.update(schema.products)
		.set({ status: 'archived' })
		.where(eq(schema.products.id, product.id))
		.returning()

	return updated
})
