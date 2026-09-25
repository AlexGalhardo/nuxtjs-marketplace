import { and, eq } from 'drizzle-orm'
import { cartItemSchema } from '#shared/schemas/cart'

// POST /api/cart/items — add a product (or more of it). Digital goods are always quantity 1.
export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const body = await readValidatedBody(event, cartItemSchema.parse)

	const [product] = await db
		.select({
			id: schema.products.id,
			kind: schema.products.kind,
			stock: schema.products.stock,
			ownerId: schema.shops.ownerId,
		})
		.from(schema.products)
		.innerJoin(schema.shops, eq(schema.products.shopId, schema.shops.id))
		.where(and(eq(schema.products.id, body.productId), ...publicProductConditions()))
	if (!product) {
		throw createError({ statusCode: 404, statusMessage: 'Product not found' })
	}
	if (product.ownerId === user.id) {
		throw createError({ statusCode: 400, statusMessage: "You can't buy from your own shop" })
	}

	const [existing] = await db
		.select({ quantity: schema.cartItems.quantity })
		.from(schema.cartItems)
		.where(
			and(eq(schema.cartItems.userId, user.id), eq(schema.cartItems.productId, product.id)),
		)
	const quantity = product.kind === 'digital' ? 1 : (existing?.quantity ?? 0) + body.quantity
	assertStock(product, quantity)

	await db
		.insert(schema.cartItems)
		.values({ userId: user.id, productId: product.id, quantity })
		.onConflictDoUpdate({
			target: [schema.cartItems.userId, schema.cartItems.productId],
			set: { quantity, updatedAt: new Date() },
		})
	return loadCart(user.id)
})
