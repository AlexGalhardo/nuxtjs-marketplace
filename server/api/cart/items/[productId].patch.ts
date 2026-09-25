import { and, eq } from 'drizzle-orm'
import { cartQuantitySchema } from '#shared/schemas/cart'

// PATCH /api/cart/items/:productId — set the quantity of a line already in the cart.
export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const productId = getRouterParam(event, 'productId') ?? ''
	const { quantity } = await readValidatedBody(event, cartQuantitySchema.parse)

	const [line] = await db
		.select({ kind: schema.products.kind, stock: schema.products.stock })
		.from(schema.cartItems)
		.innerJoin(schema.products, eq(schema.cartItems.productId, schema.products.id))
		.where(and(eq(schema.cartItems.userId, user.id), eq(schema.cartItems.productId, productId)))
	if (!line) {
		throw createError({ statusCode: 404, statusMessage: 'Item is not in your cart' })
	}
	if (line.kind === 'digital' && quantity !== 1) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Digital items are sold one at a time',
		})
	}
	assertStock(line, quantity)

	await db
		.update(schema.cartItems)
		.set({ quantity, updatedAt: new Date() })
		.where(and(eq(schema.cartItems.userId, user.id), eq(schema.cartItems.productId, productId)))
	return loadCart(user.id)
})
