import { and, eq, sql } from 'drizzle-orm'
import { reviewSchema } from '#shared/schemas/order'

// POST /api/reviews — D15: only a verified buyer (an item of their own paid, unrefunded order) can
// review, once per product (unique index; a second try is a 409). The product's rating aggregates
// are recomputed from the reviews table in the same transaction, so they can't drift.
export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const { orderItemId, rating, comment } = await readValidatedBody(event, reviewSchema.parse)

	const [item] = await db
		.select({
			productId: schema.orderItems.productId,
			sellerOrderStatus: schema.sellerOrders.status,
		})
		.from(schema.orderItems)
		.innerJoin(schema.sellerOrders, eq(schema.orderItems.sellerOrderId, schema.sellerOrders.id))
		.innerJoin(schema.orders, eq(schema.sellerOrders.orderId, schema.orders.id))
		.where(and(eq(schema.orderItems.id, orderItemId), eq(schema.orders.buyerId, user.id)))
	if (!item) {
		throw createError({ statusCode: 404, statusMessage: 'Order item not found' })
	}
	if (!isReviewable(item.sellerOrderStatus)) {
		throw createError({ statusCode: 409, statusMessage: 'Only paid orders can be reviewed' })
	}

	const [existing] = await db
		.select({ id: schema.reviews.id })
		.from(schema.reviews)
		.where(
			and(eq(schema.reviews.productId, item.productId), eq(schema.reviews.buyerId, user.id)),
		)
	if (existing) {
		throw createError({ statusCode: 409, statusMessage: 'You already reviewed this product' })
	}

	const review = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(schema.reviews)
			.values({
				productId: item.productId,
				buyerId: user.id,
				orderItemId,
				rating,
				comment: comment || null,
			})
			.returning()
		const scope = sql`from ${schema.reviews} where ${schema.reviews.productId} = ${item.productId}`
		await tx
			.update(schema.products)
			.set({
				ratingAvg: sql`(select coalesce(avg(${schema.reviews.rating}), 0) ${scope})`,
				ratingCount: sql`(select count(*) ${scope})`,
			})
			.where(eq(schema.products.id, item.productId))
		return created
	})

	setResponseStatus(event, 201)
	return review
})
