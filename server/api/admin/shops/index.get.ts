import { and, count, desc, eq } from 'drizzle-orm'
import { adminShopsQuerySchema } from '#shared/schemas/admin'

// GET /api/admin/shops — every shop with its owner and product count, newest first.
export default defineEventHandler(async (event) => {
	await requireAdmin(event)
	const query = await getValidatedQuery(event, adminShopsQuerySchema.parse)
	const where = and(
		searchAny(query.q, [schema.shops.name, schema.shops.slug, schema.users.email]),
		query.status ? eq(schema.shops.status, query.status) : undefined,
	)
	const [total] = await db
		.select({ n: count() })
		.from(schema.shops)
		.innerJoin(schema.users, eq(schema.shops.ownerId, schema.users.id))
		.where(where)
	const productCount = db
		.select({ shopId: schema.products.shopId, n: count().as('n') })
		.from(schema.products)
		.groupBy(schema.products.shopId)
		.as('product_count')
	const data = await db
		.select({
			id: schema.shops.id,
			slug: schema.shops.slug,
			name: schema.shops.name,
			status: schema.shops.status,
			chargesEnabled: schema.shops.chargesEnabled,
			createdAt: schema.shops.createdAt,
			ownerName: schema.users.name,
			ownerEmail: schema.users.email,
			products: productCount.n,
		})
		.from(schema.shops)
		.innerJoin(schema.users, eq(schema.shops.ownerId, schema.users.id))
		.leftJoin(productCount, eq(productCount.shopId, schema.shops.id))
		.where(where)
		.orderBy(desc(schema.shops.createdAt), desc(schema.shops.id))
		.limit(query.perPage)
		.offset((query.page - 1) * query.perPage)
	return {
		data: data.map((row) => ({ ...row, products: Number(row.products ?? 0) })),
		meta: pageMeta(query, total?.n),
	}
})
