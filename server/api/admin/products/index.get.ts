import { and, count, desc, eq } from 'drizzle-orm'
import { adminProductsQuerySchema } from '#shared/schemas/admin'

// GET /api/admin/products — every product in every status, with its shop, newest first.
export default defineEventHandler(async (event) => {
	await requireAdmin(event)
	const query = await getValidatedQuery(event, adminProductsQuerySchema.parse)
	const where = and(
		searchAny(query.q, [schema.products.title, schema.products.slug, schema.shops.name]),
		query.status ? eq(schema.products.status, query.status) : undefined,
	)
	const [total] = await db
		.select({ n: count() })
		.from(schema.products)
		.innerJoin(schema.shops, eq(schema.products.shopId, schema.shops.id))
		.where(where)
	const data = await db
		.select({
			id: schema.products.id,
			slug: schema.products.slug,
			title: schema.products.title,
			kind: schema.products.kind,
			status: schema.products.status,
			priceCents: schema.products.priceCents,
			createdAt: schema.products.createdAt,
			shopSlug: schema.shops.slug,
			shopName: schema.shops.name,
			shopStatus: schema.shops.status,
		})
		.from(schema.products)
		.innerJoin(schema.shops, eq(schema.products.shopId, schema.shops.id))
		.where(where)
		.orderBy(desc(schema.products.createdAt), desc(schema.products.id))
		.limit(query.perPage)
		.offset((query.page - 1) * query.perPage)
	return { data, meta: pageMeta(query, total?.n) }
})
