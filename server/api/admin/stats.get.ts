import { count, eq, inArray, sum } from 'drizzle-orm'

// GET /api/admin/stats — the numbers the admin dashboard opens with.
export default defineEventHandler(async (event) => {
	await requireAdmin(event)
	const paid = ['paid', 'partially_refunded', 'refunded'] as const
	const [[users], [shops], [suspendedShops], [products], [suspendedProducts], [orders]] =
		await Promise.all([
			db.select({ n: count() }).from(schema.users),
			db.select({ n: count() }).from(schema.shops),
			db
				.select({ n: count() })
				.from(schema.shops)
				.where(eq(schema.shops.status, 'suspended')),
			db
				.select({ n: count() })
				.from(schema.products)
				.where(eq(schema.products.status, 'published')),
			db
				.select({ n: count() })
				.from(schema.products)
				.where(eq(schema.products.status, 'suspended')),
			db
				.select({ n: count(), totalCents: sum(schema.orders.totalCents) })
				.from(schema.orders)
				.where(inArray(schema.orders.status, [...paid])),
		])
	return {
		users: users?.n ?? 0,
		shops: shops?.n ?? 0,
		suspendedShops: suspendedShops?.n ?? 0,
		publishedProducts: products?.n ?? 0,
		suspendedProducts: suspendedProducts?.n ?? 0,
		paidOrders: orders?.n ?? 0,
		// sum() comes back as a string (or null) on both drivers.
		grossCents: Number(orders?.totalCents ?? 0),
	}
})
