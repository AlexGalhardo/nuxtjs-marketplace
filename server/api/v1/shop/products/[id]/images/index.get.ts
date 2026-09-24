import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
	}
	const { product } = await requireProductOwner(event, id)

	return db
		.select()
		.from(schema.productImages)
		.where(eq(schema.productImages.productId, product.id))
		.orderBy(schema.productImages.position)
})
