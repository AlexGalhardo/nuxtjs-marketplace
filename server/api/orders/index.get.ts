import { and, desc, eq, inArray, notInArray, sum } from 'drizzle-orm'
import type { BuyerOrderSummary } from '#shared/types/order'

// GET /api/orders — the buyer's own orders, newest first. Abandoned checkouts (`expired`) and
// Stripe failures (`canceled`) never charged anything, so they stay out of the history.
// ponytail: unpaginated; add page/perPage like /api/v1/shop/products once someone has hundreds.
export default defineEventHandler(async (event): Promise<BuyerOrderSummary[]> => {
	const user = await requireUser(event)
	const orders = await db
		.select({
			id: schema.orders.id,
			status: schema.orders.status,
			totalCents: schema.orders.totalCents,
			createdAt: schema.orders.createdAt,
		})
		.from(schema.orders)
		.where(
			and(
				eq(schema.orders.buyerId, user.id),
				notInArray(schema.orders.status, ['expired', 'canceled']),
			),
		)
		.orderBy(desc(schema.orders.createdAt))
	if (!orders.length) return []

	const counts = await db
		.select({ orderId: schema.sellerOrders.orderId, items: sum(schema.orderItems.quantity) })
		.from(schema.orderItems)
		.innerJoin(schema.sellerOrders, eq(schema.orderItems.sellerOrderId, schema.sellerOrders.id))
		.where(
			inArray(
				schema.sellerOrders.orderId,
				orders.map((order) => order.id),
			),
		)
		.groupBy(schema.sellerOrders.orderId)

	return orders.map((order) => ({
		...order,
		itemCount: Number(counts.find((row) => row.orderId === order.id)?.items ?? 0),
		createdAt: order.createdAt.toISOString(),
	}))
})
