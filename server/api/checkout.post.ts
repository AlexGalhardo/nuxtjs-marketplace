import { and, eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { checkoutSchema } from '#shared/schemas/cart'

// POST /api/checkout — PLAN.md §3.5 step 1. Prices, stock, shipping and fees are recomputed from the
// DB (A06); the order rows exist before Stripe is called, so every session maps back to an order.
// ponytail: stock is checked here and decremented on payment, not reserved; two buyers racing for
// the last unit can both pay (the webhook clamps stock at 0 and logs it). Reserve if that matters.
export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const { addressId } = await readValidatedBody(event, checkoutSchema.parse)
	const config = useRuntimeConfig()
	const stripe = getStripeClient()

	const cart = await loadCart(user.id)
	if (!cart.groups.length) {
		throw createError({ statusCode: 400, statusMessage: 'Your cart is empty' })
	}
	if (!cart.canCheckout) {
		throw createError({
			statusCode: 409,
			statusMessage: 'Some items in your cart changed. Review your cart and try again',
		})
	}

	let shippingAddress: Record<string, unknown> | null = null
	if (cart.hasPhysical) {
		if (!addressId) {
			throw createError({ statusCode: 400, statusMessage: 'Pick a shipping address' })
		}
		const [address] = await db
			.select()
			.from(schema.addresses)
			.where(and(eq(schema.addresses.id, addressId), eq(schema.addresses.userId, user.id)))
		if (!address) {
			throw createError({ statusCode: 404, statusMessage: 'Address not found' })
		}
		const {
			id: _id,
			userId: _userId,
			isDefault: _isDefault,
			createdAt: _c,
			updatedAt: _u,
			...snapshot
		} = address
		shippingAddress = snapshot
	}

	const sellers = cart.groups.map((group) => ({
		group,
		totals: sellerTotals(group.lines, config.platformFeeBps),
	}))
	const sum = (key: keyof (typeof sellers)[number]['totals']) =>
		sellers.reduce((total, seller) => total + seller.totals[key], 0)

	const order = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(schema.orders)
			.values({
				buyerId: user.id,
				subtotalCents: sum('subtotalCents'),
				shippingCents: sum('shippingCents'),
				feeCents: sum('feeCents'),
				totalCents: cart.totalCents,
				shippingAddress,
			})
			.returning()
		if (!created)
			throw createError({ statusCode: 500, statusMessage: 'Could not create order' })

		for (const { group, totals } of sellers) {
			const [sellerOrder] = await tx
				.insert(schema.sellerOrders)
				.values({ orderId: created.id, shopId: group.shopId, ...totals })
				.returning({ id: schema.sellerOrders.id })
			if (!sellerOrder)
				throw createError({ statusCode: 500, statusMessage: 'Could not create order' })
			await tx.insert(schema.orderItems).values(
				group.lines.map((line) => ({
					sellerOrderId: sellerOrder.id,
					productId: line.productId,
					title: line.title,
					priceCents: line.priceCents,
					quantity: line.quantity,
					kind: line.kind,
				})),
			)
		}
		return created
	})

	const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = cart.groups.flatMap(
		(group) => [
			...group.lines.map((line) => ({
				quantity: line.quantity,
				price_data: {
					currency: 'usd',
					unit_amount: line.priceCents,
					product_data: { name: line.title, metadata: { productId: line.productId } },
				},
			})),
			...(group.shippingCents > 0
				? [
						{
							quantity: 1,
							price_data: {
								currency: 'usd',
								unit_amount: group.shippingCents,
								product_data: { name: `shipping from ${group.shopName}` },
							},
						},
					]
				: []),
		],
	)

	const siteUrl = config.public.siteUrl.replace(/\/$/, '')
	let session: Stripe.Checkout.Session
	try {
		session = await stripe.checkout.sessions.create(
			{
				mode: 'payment',
				line_items: lineItems,
				customer_email: user.email,
				client_reference_id: order.id,
				metadata: { orderId: order.id },
				payment_intent_data: { transfer_group: order.id, metadata: { orderId: order.id } },
				success_url: `${siteUrl}/checkout/success?order=${order.id}`,
				cancel_url: `${siteUrl}/cart`,
			},
			{ idempotencyKey: `checkout-${order.id}` },
		)
	} catch {
		// A10: never leave a pending order behind that no Stripe session can ever complete.
		await db
			.update(schema.orders)
			.set({ status: 'canceled' })
			.where(eq(schema.orders.id, order.id))
		await db
			.update(schema.sellerOrders)
			.set({ status: 'canceled' })
			.where(eq(schema.sellerOrders.orderId, order.id))
		throw createError({
			statusCode: 502,
			statusMessage: 'Payment provider is unavailable, try again',
		})
	}

	await db
		.update(schema.orders)
		.set({ stripeCheckoutSessionId: session.id })
		.where(eq(schema.orders.id, order.id))
	await logTransaction({
		type: 'checkout.created',
		orderId: order.id,
		userId: user.id,
		stripeObjectId: session.id,
		amountCents: order.totalCents,
		status: 'pending',
		payload: { sellers: sellers.length, feeCents: order.feeCents },
	})

	return { orderId: order.id, url: session.url }
})
