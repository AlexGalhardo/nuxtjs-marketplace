import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({ order: z.array(z.string().min(1)).min(1) })

// POST /api/v1/shop/products/:id/images/reorder — body { order: [imageId, ...] }, full list of
// this product's image ids in the desired display order.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
	}
	const { product } = await requireProductOwner(event, id)
	const body = await readValidatedBody(event, bodySchema.parse)

	const existing = await db
		.select()
		.from(schema.productImages)
		.where(eq(schema.productImages.productId, product.id))
	const existingIds = new Set(existing.map((image) => image.id))

	if (
		body.order.length !== existing.length ||
		body.order.some((imageId) => !existingIds.has(imageId))
	) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Order must list every image exactly once',
		})
	}

	for (const [position, imageId] of body.order.entries()) {
		await db
			.update(schema.productImages)
			.set({ position })
			.where(
				and(
					eq(schema.productImages.id, imageId),
					eq(schema.productImages.productId, product.id),
				),
			)
	}

	return db
		.select()
		.from(schema.productImages)
		.where(eq(schema.productImages.productId, product.id))
		.orderBy(schema.productImages.position)
})
