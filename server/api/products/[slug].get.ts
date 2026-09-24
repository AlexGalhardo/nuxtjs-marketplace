import { and, asc, eq } from 'drizzle-orm'

// GET /api/products/:slug — public product page data. 404 for anything not publicly visible
// (draft, archived, suspended, or its shop can't take payments) — never a 403 that leaks existence.
export default defineEventHandler(async (event) => {
	const slug = getRouterParam(event, 'slug')
	if (!slug) {
		throw createError({ statusCode: 400, statusMessage: 'Missing product slug' })
	}

	const [product] = await db
		.select({
			id: schema.products.id,
			slug: schema.products.slug,
			title: schema.products.title,
			description: schema.products.description,
			kind: schema.products.kind,
			priceCents: schema.products.priceCents,
			shippingCents: schema.products.shippingCents,
			stock: schema.products.stock,
			ratingAvg: schema.products.ratingAvg,
			ratingCount: schema.products.ratingCount,
			createdAt: schema.products.createdAt,
			type: { slug: schema.productTypes.slug, name: schema.productTypes.name },
			shop: publicShopColumns,
		})
		.from(schema.products)
		.innerJoin(schema.shops, eq(schema.products.shopId, schema.shops.id))
		.innerJoin(schema.productTypes, eq(schema.products.productTypeId, schema.productTypes.id))
		.where(and(eq(schema.products.slug, slug), ...publicProductConditions()))
	if (!product) {
		throw createError({ statusCode: 404, statusMessage: 'Product not found' })
	}

	const images = await db
		.select({
			id: schema.productImages.id,
			blobPath: schema.productImages.blobPath,
			alt: schema.productImages.alt,
		})
		.from(schema.productImages)
		.where(eq(schema.productImages.productId, product.id))
		.orderBy(asc(schema.productImages.position))

	return { ...product, images }
})
