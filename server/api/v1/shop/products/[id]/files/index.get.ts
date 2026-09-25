import { eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['products'],
		summary: 'List a digital product’s files',
	},
})

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
	}
	const { product } = await requireProductOwner(event, id)

	return db
		.select()
		.from(schema.productFiles)
		.where(eq(schema.productFiles.productId, product.id))
})
