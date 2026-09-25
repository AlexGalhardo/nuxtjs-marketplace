import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['orders'],
		summary: 'Mark an order delivered',
		description: 'Only from `shipped`.',
	},
})

// POST /api/v1/shop/orders/:id/deliver — the seller confirms a shipped order arrived.
export default defineEventHandler(async (event) => {
	const sellerOrder = await requireOwnSellerOrder(event)
	const [updated] = await db
		.update(schema.sellerOrders)
		.set({ status: 'delivered', updatedAt: new Date() })
		.where(
			and(
				eq(schema.sellerOrders.id, sellerOrder.id),
				eq(schema.sellerOrders.status, 'shipped'),
			),
		)
		.returning()
	if (!updated) {
		throw createError({
			statusCode: 409,
			statusMessage: 'Only shipped orders can be delivered',
		})
	}
	return updated
})
