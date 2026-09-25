defineRouteMeta({
	openAPI: {
		tags: ['orders'],
		summary: 'Refund an order in full',
		description:
			'Refunds what the buyer paid you (items + shipping), reverses your payout and revokes downloads. Cannot be undone.',
	},
})

// POST /api/v1/shop/orders/:id/refund — full refund of the seller's part of the order (D15).
export default defineEventHandler(async (event) => {
	const sellerOrder = await requireOwnSellerOrder(event)
	await refundSellerOrder(sellerOrder)
	return { refunded: true }
})
