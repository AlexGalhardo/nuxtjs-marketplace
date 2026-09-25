// POST /api/v1/shop/orders/:id/refund — full refund of the seller's part of the order (D15).
export default defineEventHandler(async (event) => {
	const sellerOrder = await requireOwnSellerOrder(event)
	await refundSellerOrder(sellerOrder)
	return { refunded: true }
})
