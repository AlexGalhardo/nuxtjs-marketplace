import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['products'],
		summary: 'Delete a product image',
	},
})

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	const imageId = getRouterParam(event, 'imageId')
	if (!id || !imageId) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product or image id' })
	}
	const { product } = await requireProductOwner(event, id)

	const [image] = await db
		.select()
		.from(schema.productImages)
		.where(
			and(
				eq(schema.productImages.id, imageId),
				eq(schema.productImages.productId, product.id),
			),
		)
	if (!image) {
		throw createError({ statusCode: 404, statusMessage: 'Image not found' })
	}

	await db.delete(schema.productImages).where(eq(schema.productImages.id, image.id))
	await blob.del(image.blobPath).catch(() => {})

	return { success: true }
})
