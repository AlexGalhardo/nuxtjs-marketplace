import { desc, eq, inArray } from 'drizzle-orm'
import type { ShopOrder } from '#shared/types/order'

defineRouteMeta({
	openAPI: {
		tags: ['orders'],
		summary: 'List your sales',
		description:
			'Paid (or later) seller orders, newest first, with items, payout and the shipping address when something physical is in it.',
	},
})

// GET /api/v1/shop/orders — the seller's orders, newest first. Unpaid checkouts (`pending`,
// `canceled`) are not sales yet, so they stay hidden. The buyer's address is shared only because
// the seller has to ship to it.
// ponytail: unpaginated; add page/perPage like /api/v1/shop/products once a shop has hundreds.
export default defineEventHandler(async (event): Promise<ShopOrder[]> => {
	const user = await requireUser(event)
	const rows = await db
		.select({
			id: schema.sellerOrders.id,
			orderId: schema.sellerOrders.orderId,
			status: schema.sellerOrders.status,
			subtotalCents: schema.sellerOrders.subtotalCents,
			shippingCents: schema.sellerOrders.shippingCents,
			feeCents: schema.sellerOrders.feeCents,
			payoutCents: schema.sellerOrders.payoutCents,
			carrier: schema.sellerOrders.carrier,
			trackingCode: schema.sellerOrders.trackingCode,
			shippedAt: schema.sellerOrders.shippedAt,
			createdAt: schema.sellerOrders.createdAt,
			buyerName: schema.users.name,
			shippingAddress: schema.orders.shippingAddress,
		})
		.from(schema.sellerOrders)
		.innerJoin(schema.shops, eq(schema.sellerOrders.shopId, schema.shops.id))
		.innerJoin(schema.orders, eq(schema.sellerOrders.orderId, schema.orders.id))
		.innerJoin(schema.users, eq(schema.orders.buyerId, schema.users.id))
		.where(eq(schema.shops.ownerId, user.id))
		.orderBy(desc(schema.sellerOrders.createdAt))
	const sales = rows.filter((row) => row.status !== 'pending' && row.status !== 'canceled')
	if (!sales.length) return []

	const items = await db
		.select({
			sellerOrderId: schema.orderItems.sellerOrderId,
			title: schema.orderItems.title,
			quantity: schema.orderItems.quantity,
			priceCents: schema.orderItems.priceCents,
			kind: schema.orderItems.kind,
		})
		.from(schema.orderItems)
		.where(
			inArray(
				schema.orderItems.sellerOrderId,
				sales.map((row) => row.id),
			),
		)

	return sales.map((row) => {
		const lines = items.filter((item) => item.sellerOrderId === row.id)
		return {
			...row,
			shippedAt: row.shippedAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
			// Digital-only sales ship nothing, so the seller has no reason to see the address.
			shippingAddress: lines.some((line) => line.kind === 'physical')
				? (row.shippingAddress as ShopOrder['shippingAddress'])
				: null,
			items: lines.map(({ sellerOrderId: _id, ...line }) => line),
		}
	})
})
