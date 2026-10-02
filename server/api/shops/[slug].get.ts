import { and, eq } from 'drizzle-orm'

// GET /api/shops/:slug — public storefront header. Products come from GET /api/products?shop=:slug.
export default defineCachedEventHandler(async (event) => {
	const slug = getRouterParam(event, 'slug')
	if (!slug) {
		throw createError({ statusCode: 400, statusMessage: 'Missing shop slug' })
	}

	const [shop] = await db
		.select(publicShopColumns)
		.from(schema.shops)
		.where(and(eq(schema.shops.slug, slug), eq(schema.shops.status, 'active')))
	if (!shop) {
		throw createError({ statusCode: 404, statusMessage: 'Shop not found' })
	}
	return shop
}, catalogCache)
