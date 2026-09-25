import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type Stripe from 'stripe'

// D8: digital purchases get this many downloads within this window (per file).
export const downloadLimits = { maxDownloads: 5, ttlDays: 30 }

// PLAN.md §3.5 step 2. Safe to call more than once for the same session: the pending → paid update
// is conditional, so only the first call fulfils; transfers also carry Stripe idempotency keys.
export async function fulfillCheckout(session: Stripe.Checkout.Session): Promise<void> {
	const orderId = session.metadata?.orderId
	// Async payment methods complete unpaid first; `checkout.session.async_payment_succeeded` follows.
	if (!orderId || session.payment_status !== 'paid') return

	const stripe = getStripeClient()
	const paymentIntentId =
		typeof session.payment_intent === 'string'
			? session.payment_intent
			: session.payment_intent?.id
	const paymentIntent = paymentIntentId
		? await stripe.paymentIntents.retrieve(paymentIntentId)
		: null
	const chargeId =
		typeof paymentIntent?.latest_charge === 'string'
			? paymentIntent.latest_charge
			: (paymentIntent?.latest_charge?.id ?? null)

	const items = await db
		.select({
			productId: schema.orderItems.productId,
			orderItemId: schema.orderItems.id,
			title: schema.orderItems.title,
			quantity: schema.orderItems.quantity,
			kind: schema.orderItems.kind,
		})
		.from(schema.orderItems)
		.innerJoin(schema.sellerOrders, eq(schema.orderItems.sellerOrderId, schema.sellerOrders.id))
		.where(eq(schema.sellerOrders.orderId, orderId))

	const order = await db.transaction(async (tx) => {
		const [paid] = await tx
			.update(schema.orders)
			.set({
				status: 'paid',
				stripePaymentIntentId: paymentIntentId ?? null,
				updatedAt: new Date(),
			})
			.where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, 'pending')))
			.returning()
		if (!paid) return null

		await tx
			.update(schema.sellerOrders)
			.set({ status: 'paid', updatedAt: new Date() })
			.where(eq(schema.sellerOrders.orderId, orderId))

		for (const item of items.filter((line) => line.kind === 'physical')) {
			// Clamped at 0: an oversold last unit is visible to the seller, never negative stock.
			await tx
				.update(schema.products)
				.set({
					stock: sql`case when ${schema.products.stock} >= ${item.quantity} then ${schema.products.stock} - ${item.quantity} else 0 end`,
				})
				.where(
					and(eq(schema.products.id, item.productId), isNotNull(schema.products.stock)),
				)
		}

		const digital = items.filter((line) => line.kind === 'digital')
		if (digital.length) {
			const files = await tx
				.select({ id: schema.productFiles.id, productId: schema.productFiles.productId })
				.from(schema.productFiles)
				.where(
					inArray(
						schema.productFiles.productId,
						digital.map((line) => line.productId),
					),
				)
			const expiresAt = new Date(Date.now() + downloadLimits.ttlDays * 86_400_000)
			const grants = digital.flatMap((line) =>
				files
					.filter((file) => file.productId === line.productId)
					.map((file) => ({
						orderItemId: line.orderItemId,
						buyerId: paid.buyerId,
						productFileId: file.id,
						maxDownloads: downloadLimits.maxDownloads,
						expiresAt,
					})),
			)
			if (grants.length) await tx.insert(schema.downloadGrants).values(grants)
		}

		await tx.delete(schema.cartItems).where(
			and(
				eq(schema.cartItems.userId, paid.buyerId),
				inArray(
					schema.cartItems.productId,
					items.map((line) => line.productId),
				),
			),
		)
		await logTransaction(
			{
				type: 'payment.succeeded',
				orderId,
				userId: paid.buyerId,
				stripeObjectId: chargeId ?? paymentIntentId,
				amountCents: session.amount_total ?? paid.totalCents,
				status: 'succeeded',
				payload: { checkoutSessionId: session.id, paymentIntentId, chargeId },
			},
			tx,
		)
		return paid
	})
	if (!order) return

	const sellers = await db
		.select({
			id: schema.sellerOrders.id,
			shopId: schema.sellerOrders.shopId,
			payoutCents: schema.sellerOrders.payoutCents,
			subtotalCents: schema.sellerOrders.subtotalCents,
			stripeAccountId: schema.shops.stripeAccountId,
			shopName: schema.shops.name,
			ownerEmail: schema.users.email,
		})
		.from(schema.sellerOrders)
		.innerJoin(schema.shops, eq(schema.sellerOrders.shopId, schema.shops.id))
		.innerJoin(schema.users, eq(schema.shops.ownerId, schema.users.id))
		.where(eq(schema.sellerOrders.orderId, orderId))

	for (const seller of sellers) {
		await transferToSeller(stripe, orderId, chargeId, seller)
	}
	await sendOrderEmails(order, items, sellers)
}

// ponytail: a failed transfer is logged (`transfer.failed`) and not retried automatically; admin
// retry lands with the Phase 11 transaction-log tooling.
async function transferToSeller(
	stripe: Stripe,
	orderId: string,
	chargeId: string | null,
	seller: { id: string; shopId: string; payoutCents: number; stripeAccountId: string | null },
): Promise<void> {
	const base = {
		orderId,
		sellerOrderId: seller.id,
		shopId: seller.shopId,
		amountCents: seller.payoutCents,
	}
	if (seller.payoutCents <= 0) return
	try {
		if (!seller.stripeAccountId || !chargeId) {
			throw new Error(
				!chargeId
					? 'Payment has no charge to fund the transfer'
					: 'Shop has no Stripe account',
			)
		}
		const transfer = await stripe.transfers.create(
			{
				amount: seller.payoutCents,
				currency: 'usd',
				destination: seller.stripeAccountId,
				transfer_group: orderId,
				source_transaction: chargeId,
				metadata: { orderId, sellerOrderId: seller.id },
			},
			{ idempotencyKey: `transfer-${seller.id}` },
		)
		await db
			.update(schema.sellerOrders)
			.set({ stripeTransferId: transfer.id })
			.where(eq(schema.sellerOrders.id, seller.id))
		await logTransaction({
			...base,
			type: 'transfer.created',
			stripeObjectId: transfer.id,
			status: 'succeeded',
		})
	} catch (error) {
		await logTransaction({
			...base,
			type: 'transfer.failed',
			status: 'failed',
			payload: { message: error instanceof Error ? error.message : String(error) },
		})
	}
}

async function sendOrderEmails(
	order: { id: string; buyerId: string; totalCents: number },
	items: { title: string; quantity: number; kind: string }[],
	sellers: { shopName: string; ownerEmail: string; payoutCents: number; id: string }[],
): Promise<void> {
	const siteUrl = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
	const [buyer] = await db
		.select({ email: schema.users.email, name: schema.users.name })
		.from(schema.users)
		.where(eq(schema.users.id, order.buyerId))
	const list = items.map((item) => `- ${item.quantity} × ${item.title}`).join('\n')
	const mails = [
		buyer && {
			to: buyer.email,
			subject: 'your resell.sh order is paid',
			text: `hi ${buyer.name},\n\nyour payment of ${formatMoney(order.totalCents)} went through.\n\n${list}\n\ndigital items are ready to download and sellers will ship the rest.\nyour orders: ${siteUrl}/orders/${order.id}\n`,
		},
		...sellers.map((seller) => ({
			to: seller.ownerEmail,
			subject: `you made a sale on ${seller.shopName}`,
			text: `someone just bought from ${seller.shopName}. your payout for this order is ${formatMoney(seller.payoutCents)}.\n\nsee what to ship: ${siteUrl}/my-shop\n`,
		})),
	]
	for (const mail of mails) {
		if (!mail) continue
		// A10: a mail outage must not fail the webhook after money already moved.
		await sendMail(mail).catch((error: unknown) =>
			console.error('[orders] email failed', error),
		)
	}
}

// PLAN.md §3.5 step 4.
export async function expireCheckout(session: Stripe.Checkout.Session): Promise<void> {
	const orderId = session.metadata?.orderId
	if (!orderId) return
	const [expired] = await db
		.update(schema.orders)
		.set({ status: 'expired', updatedAt: new Date() })
		.where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, 'pending')))
		.returning()
	if (!expired) return
	await db
		.update(schema.sellerOrders)
		.set({ status: 'canceled', updatedAt: new Date() })
		.where(eq(schema.sellerOrders.orderId, orderId))
	await logTransaction({
		type: 'checkout.expired',
		orderId,
		userId: expired.buyerId,
		stripeObjectId: session.id,
		amountCents: expired.totalCents,
		status: 'expired',
	})
}

export async function recordDispute(dispute: Stripe.Dispute): Promise<void> {
	const paymentIntentId =
		typeof dispute.payment_intent === 'string'
			? dispute.payment_intent
			: dispute.payment_intent?.id
	const [order] = paymentIntentId
		? await db
				.select({ id: schema.orders.id, buyerId: schema.orders.buyerId })
				.from(schema.orders)
				.where(eq(schema.orders.stripePaymentIntentId, paymentIntentId))
		: []
	await logTransaction({
		type: 'dispute.created',
		orderId: order?.id,
		userId: order?.buyerId,
		stripeObjectId: dispute.id,
		amountCents: dispute.amount,
		status: dispute.status,
		payload: { reason: dispute.reason, charge: dispute.charge },
	})
}
