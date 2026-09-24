import { and, eq } from 'drizzle-orm'

const staticPaths = ['/', '/marketplace', '/contact', '/terms', '/privacy', '/login', '/signup']
// ponytail: single sitemap capped at the protocol's 50k URLs; split into a sitemap index if the catalog grows past it.
const maxEntries = 45_000

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig()
	const siteUrl = config.public.siteUrl.replace(/\/$/, '')

	const [products, shops] = await Promise.all([
		db
			.select({ slug: schema.products.slug })
			.from(schema.products)
			.innerJoin(schema.shops, eq(schema.products.shopId, schema.shops.id))
			.where(and(...publicProductConditions()))
			.limit(maxEntries),
		db
			.select({ slug: schema.shops.slug })
			.from(schema.shops)
			.where(eq(schema.shops.status, 'active'))
			.limit(maxEntries),
	])

	const paths = [
		...staticPaths,
		...products.map((product) => `/products/${encodeURIComponent(product.slug)}`),
		...shops.map((shop) => `/shops/${encodeURIComponent(shop.slug)}`),
	]
	const urls = paths.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n')

	setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
})
