import { eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['products'],
		summary: 'Delete a product',
	},
})

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id')
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
	}

	const { product } = await requireProductOwner(event, id)

	const images = await db
		.select()
		.from(schema.productImages)
		.where(eq(schema.productImages.productId, product.id))
	const files = await db
		.select()
		.from(schema.productFiles)
		.where(eq(schema.productFiles.productId, product.id))

	// No ON DELETE CASCADE on product_images/product_files (server/db/schema.*.ts): delete the
	// children before the parent to avoid a foreign key violation.
	await db.delete(schema.productImages).where(eq(schema.productImages.productId, product.id))
	await db.delete(schema.productFiles).where(eq(schema.productFiles.productId, product.id))
	await db.delete(schema.products).where(eq(schema.products.id, product.id))

	const blobPaths = [
		...images.map((image) => image.blobPath),
		...files.map((file) => file.blobPath),
	]
	if (blobPaths.length) {
		await blob.del(blobPaths).catch(() => {})
	}

	return { success: true }
})
