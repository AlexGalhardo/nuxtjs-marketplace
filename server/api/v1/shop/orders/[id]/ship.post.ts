import { and, eq, inArray } from 'drizzle-orm'
import { shipSellerOrderSchema } from '#shared/schemas/order'

// POST /api/v1/shop/orders/:id/ship — D11: the seller marks a paid order shipped with a carrier and
// tracking code. Calling it again while `shipped` corrects the tracking details.
export default defineEventHandler(async (event) => {
	const sellerOrder = await requireOwnSellerOrder(event)
	const { carrier, trackingCode } = await readValidatedBody(event, shipSellerOrderSchema.parse)

	const physical = await db
		.select({ id: schema.orderItems.id })
		.from(schema.orderItems)
		.where(
			and(
				eq(schema.orderItems.sellerOrderId, sellerOrder.id),
				eq(schema.orderItems.kind, 'physical'),
			),
		)
	if (!physical.length) {
		throw createError({ statusCode: 400, statusMessage: 'Digital orders have nothing to ship' })
	}

	const [updated] = await db
		.update(schema.sellerOrders)
		.set({
			status: 'shipped',
			carrier,
			trackingCode,
			shippedAt: sellerOrder.shippedAt ?? new Date(),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(schema.sellerOrders.id, sellerOrder.id),
				inArray(schema.sellerOrders.status, ['paid', 'shipped']),
			),
		)
		.returning()
	if (!updated) {
		throw createError({ statusCode: 409, statusMessage: 'This order can’t be shipped' })
	}

	if (sellerOrder.status === 'paid') {
		await notifyBuyer(
			updated.orderId,
			'your resell.sh order shipped',
			`your order is on its way with ${carrier}. tracking code: ${trackingCode}`,
		)
	}
	return updated
})
