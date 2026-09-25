import { and, eq, inArray } from 'drizzle-orm'
import type { BuyerOrder, BuyerSellerOrder } from '#shared/types/order'

// GET /api/orders/:id — the buyer's own order, grouped by seller, with shipping, download links
// (minted fresh on every read, D8) and review state. Someone else's order is a 404, never a 403
// (A01: don't confirm it exists).
export default defineEventHandler(async (event): Promise<BuyerOrder> => {
	const user = await requireUser(event)
	const id = getRouterParam(event, 'id') ?? ''

	const [order] = await db
		.select({
			id: schema.orders.id,
			status: schema.orders.status,
			subtotalCents: schema.orders.subtotalCents,
			shippingCents: schema.orders.shippingCents,
			totalCents: schema.orders.totalCents,
			shippingAddress: schema.orders.shippingAddress,
			createdAt: schema.orders.createdAt,
		})
		.from(schema.orders)
		.where(and(eq(schema.orders.id, id), eq(schema.orders.buyerId, user.id)))
	if (!order) {
		throw createError({ statusCode: 404, statusMessage: 'Order not found' })
	}

	const sellerRows = await db
		.select({
			id: schema.sellerOrders.id,
			status: schema.sellerOrders.status,
			shopName: schema.shops.name,
			shopSlug: schema.shops.slug,
			subtotalCents: schema.sellerOrders.subtotalCents,
			shippingCents: schema.sellerOrders.shippingCents,
			carrier: schema.sellerOrders.carrier,
			trackingCode: schema.sellerOrders.trackingCode,
			shippedAt: schema.sellerOrders.shippedAt,
		})
		.from(schema.sellerOrders)
		.innerJoin(schema.shops, eq(schema.sellerOrders.shopId, schema.shops.id))
		.where(eq(schema.sellerOrders.orderId, order.id))

	const items = sellerRows.length
		? await db
				.select({
					id: schema.orderItems.id,
					sellerOrderId: schema.orderItems.sellerOrderId,
					productId: schema.orderItems.productId,
					productSlug: schema.products.slug,
					title: schema.orderItems.title,
					priceCents: schema.orderItems.priceCents,
					quantity: schema.orderItems.quantity,
					kind: schema.orderItems.kind,
				})
				.from(schema.orderItems)
				.innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
				.where(
					inArray(
						schema.orderItems.sellerOrderId,
						sellerRows.map((row) => row.id),
					),
				)
		: []

	const itemIds = items.map((item) => item.id)
	const grants = itemIds.length
		? await db
				.select({
					id: schema.downloadGrants.id,
					orderItemId: schema.downloadGrants.orderItemId,
					filename: schema.productFiles.filename,
					downloadCount: schema.downloadGrants.downloadCount,
					maxDownloads: schema.downloadGrants.maxDownloads,
					expiresAt: schema.downloadGrants.expiresAt,
				})
				.from(schema.downloadGrants)
				.innerJoin(
					schema.productFiles,
					eq(schema.downloadGrants.productFileId, schema.productFiles.id),
				)
				.where(
					and(
						inArray(schema.downloadGrants.orderItemId, itemIds),
						eq(schema.downloadGrants.buyerId, user.id),
					),
				)
		: []
	// One review per product per buyer (D15), whichever order it came from.
	const reviews = items.length
		? await db
				.select({
					productId: schema.reviews.productId,
					rating: schema.reviews.rating,
					comment: schema.reviews.comment,
				})
				.from(schema.reviews)
				.where(
					and(
						eq(schema.reviews.buyerId, user.id),
						inArray(
							schema.reviews.productId,
							items.map((item) => item.productId),
						),
					),
				)
		: []

	const now = Date.now()
	const sellers: BuyerSellerOrder[] = sellerRows.map((seller) => ({
		...seller,
		shippedAt: seller.shippedAt?.toISOString() ?? null,
		items: items
			.filter((item) => item.sellerOrderId === seller.id)
			.map(({ sellerOrderId: _s, productId, ...item }) => {
				const review = reviews.find((row) => row.productId === productId)
				return {
					...item,
					downloads: grants
						.filter((grant) => grant.orderItemId === item.id)
						.map((grant) => {
							const downloadsLeft = Math.max(
								grant.maxDownloads - grant.downloadCount,
								0,
							)
							const usable = downloadsLeft > 0 && grant.expiresAt.getTime() > now
							return {
								id: grant.id,
								filename: grant.filename,
								downloadsLeft,
								expiresAt: grant.expiresAt.toISOString(),
								url: usable ? signedDownloadUrl(grant.id) : null,
							}
						}),
					review: review ? { rating: review.rating, comment: review.comment } : null,
					canReview: !review && isReviewable(seller.status),
				}
			}),
	}))

	return {
		...order,
		shippingAddress: order.shippingAddress as BuyerOrder['shippingAddress'],
		createdAt: order.createdAt.toISOString(),
		sellers,
	}
})
