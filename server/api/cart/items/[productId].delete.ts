import { and, eq } from 'drizzle-orm'

// DELETE /api/cart/items/:productId — idempotent: removing a missing line is not an error.
export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const productId = getRouterParam(event, 'productId') ?? ''
	await db
		.delete(schema.cartItems)
		.where(and(eq(schema.cartItems.userId, user.id), eq(schema.cartItems.productId, productId)))
	return loadCart(user.id)
})
