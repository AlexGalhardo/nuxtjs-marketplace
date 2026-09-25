import { and, eq } from 'drizzle-orm'

// GET /api/orders/:id — the buyer's own order (checkout success page; Phase 9 adds the full view).
// Someone else's order is a 404, never a 403 (A01: don't confirm it exists).
export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const id = getRouterParam(event, 'id') ?? ''

	const [order] = await db
		.select({
			id: schema.orders.id,
			status: schema.orders.status,
			subtotalCents: schema.orders.subtotalCents,
			shippingCents: schema.orders.shippingCents,
			totalCents: schema.orders.totalCents,
			createdAt: schema.orders.createdAt,
		})
		.from(schema.orders)
		.where(and(eq(schema.orders.id, id), eq(schema.orders.buyerId, user.id)))
	if (!order) {
		throw createError({ statusCode: 404, statusMessage: 'Order not found' })
	}

	const items = await db
		.select({
			title: schema.orderItems.title,
			quantity: schema.orderItems.quantity,
			priceCents: schema.orderItems.priceCents,
			kind: schema.orderItems.kind,
			shopName: schema.shops.name,
		})
		.from(schema.orderItems)
		.innerJoin(schema.sellerOrders, eq(schema.orderItems.sellerOrderId, schema.sellerOrders.id))
		.innerJoin(schema.shops, eq(schema.sellerOrders.shopId, schema.shops.id))
		.where(eq(schema.sellerOrders.orderId, order.id))

	return { ...order, items }
})
