import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type Stripe from 'stripe'
import type { SellerOrder } from '#shared/types/db'
import type { SellerOrderStatus } from '#shared/types/enums'

// D8: digital purchases get this many downloads within this window (per file).
export const downloadLimits = { maxDownloads: 5, ttlDays: 30 }

// PLAN.md §3.5 step 2. Safe to call more than once for the same session: the pending → paid update
// is conditional, so only the first call fulfils and emails. Transfers run on every call for seller
// orders that never got one attempted (a crash after the commit leaves them pending; Stripe's retry of
// the unprocessed event then pays the seller), and carry Stripe idempotency keys.
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

	const sellers = await db
		.select({
			id: schema.sellerOrders.id,
			shopId: schema.sellerOrders.shopId,
			status: schema.sellerOrders.status,
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

	// Every attempt (created or failed) is logged, so "no transfer log" means it never ran.
	const attempted = new Set(
		(
			await db
				.select({ sellerOrderId: schema.transactionLogs.sellerOrderId })
				.from(schema.transactionLogs)
				.where(
					and(
						eq(schema.transactionLogs.orderId, orderId),
						inArray(schema.transactionLogs.type, [
							'transfer.created',
							'transfer.failed',
						]),
					),
				)
		).map((row) => row.sellerOrderId),
	)
	for (const seller of sellers) {
		if (seller.status !== 'paid' || attempted.has(seller.id)) continue
		await transferToSeller(stripe, orderId, chargeId, seller)
	}
	if (order) await sendOrderEmails(order, items, sellers)
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
		// Stripe retries a slow webhook while the first delivery still runs: both reach this point (the
		// idempotency key makes it one transfer at Stripe). Only the delivery that records the transfer
		// logs it, or the ledger counts the payout twice (found by the QA suite, tests/qa/abuse.spec.ts).
		const [recorded] = await db
			.update(schema.sellerOrders)
			.set({ stripeTransferId: transfer.id })
			.where(
				and(
					eq(schema.sellerOrders.id, seller.id),
					isNull(schema.sellerOrders.stripeTransferId),
				),
			)
			.returning({ id: schema.sellerOrders.id })
		if (!recorded) return
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
		await queueMail(mail).catch((error: unknown) =>
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

// `charge.dispute.created` and `charge.dispute.closed` (status won/lost) both land in the ledger.
export async function recordDispute(
	dispute: Stripe.Dispute,
	type: 'dispute.created' | 'dispute.closed' = 'dispute.created',
): Promise<void> {
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
		type,
		orderId: order?.id,
		userId: order?.buyerId,
		stripeObjectId: dispute.id,
		amountCents: dispute.amount,
		status: dispute.status,
		payload: { reason: dispute.reason, charge: dispute.charge },
	})
}

// A seller order that was paid and not refunded: it can still be shipped, reviewed or refunded.
const liveStatuses: SellerOrderStatus[] = ['paid', 'shipped', 'delivered']
export function isReviewable(status: SellerOrderStatus): boolean {
	return liveStatuses.includes(status)
}

// A01: a seller order of the session user's own shop, else 404 (never confirm other shops' orders).
export async function requireOwnSellerOrder(event: H3Event): Promise<SellerOrder> {
	const user = await requireUser(event)
	const id = getRouterParam(event, 'id') ?? ''
	const [row] = await db
		.select({ sellerOrder: schema.sellerOrders })
		.from(schema.sellerOrders)
		.innerJoin(schema.shops, eq(schema.sellerOrders.shopId, schema.shops.id))
		.where(and(eq(schema.sellerOrders.id, id), eq(schema.shops.ownerId, user.id)))
	if (!row) {
		throw createError({ statusCode: 404, statusMessage: 'Order not found' })
	}
	return row.sellerOrder
}

export async function notifyBuyer(orderId: string, subject: string, text: string): Promise<void> {
	const [buyer] = await db
		.select({ email: schema.users.email, name: schema.users.name })
		.from(schema.orders)
		.innerJoin(schema.users, eq(schema.orders.buyerId, schema.users.id))
		.where(eq(schema.orders.id, orderId))
	if (!buyer) return
	const siteUrl = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
	await queueMail({
		to: buyer.email,
		subject,
		text: `hi ${buyer.name},\n\n${text}\n\nyour order: ${siteUrl}/orders/${orderId}\n`,
	}).catch((error: unknown) => console.error('[orders] email failed', error))
}

// PLAN.md §3.5 step 3 (D15): full refund of one seller's part of an order. The buyer gets back what
// they paid that seller (items + shipping); the platform refunds its fee too and reverses the
// seller's transfer. Stripe idempotency keys make a double click (or a retry after a crash) safe,
// and the conditional status update means only one request logs and revokes.
// ponytail: stock is not restocked on refund; the seller re-edits stock if the item came back.
export async function refundSellerOrder(sellerOrder: SellerOrder): Promise<void> {
	if (!liveStatuses.includes(sellerOrder.status)) {
		throw createError({ statusCode: 409, statusMessage: 'Only paid orders can be refunded' })
	}
	const [order] = await db
		.select({
			id: schema.orders.id,
			buyerId: schema.orders.buyerId,
			paymentIntentId: schema.orders.stripePaymentIntentId,
		})
		.from(schema.orders)
		.where(eq(schema.orders.id, sellerOrder.orderId))
	if (!order?.paymentIntentId) {
		throw createError({ statusCode: 409, statusMessage: 'This order has no payment to refund' })
	}

	const stripe = getStripeClient()
	const amountCents = sellerOrder.subtotalCents + sellerOrder.shippingCents
	const base = {
		orderId: order.id,
		sellerOrderId: sellerOrder.id,
		shopId: sellerOrder.shopId,
		userId: order.buyerId,
	}
	let refund: Stripe.Refund
	try {
		refund = await stripe.refunds.create(
			{
				payment_intent: order.paymentIntentId,
				amount: amountCents,
				metadata: { orderId: order.id, sellerOrderId: sellerOrder.id },
			},
			{ idempotencyKey: `refund-${sellerOrder.id}` },
		)
	} catch (error) {
		await logTransaction({
			...base,
			type: 'refund.failed',
			amountCents,
			status: 'failed',
			payload: { message: error instanceof Error ? error.message : String(error) },
		})
		throw createError({
			statusCode: 502,
			statusMessage: 'Stripe could not process the refund, try again',
		})
	}

	const refunded = await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(schema.sellerOrders)
			.set({ status: 'refunded', updatedAt: new Date() })
			.where(
				and(
					eq(schema.sellerOrders.id, sellerOrder.id),
					inArray(schema.sellerOrders.status, liveStatuses),
				),
			)
			.returning()
		if (!updated) return false

		// D8: refunded downloads stop working immediately.
		await tx
			.update(schema.downloadGrants)
			.set({ expiresAt: new Date() })
			.where(
				inArray(
					schema.downloadGrants.orderItemId,
					tx
						.select({ id: schema.orderItems.id })
						.from(schema.orderItems)
						.where(eq(schema.orderItems.sellerOrderId, sellerOrder.id)),
				),
			)
		const siblings = await tx
			.select({ status: schema.sellerOrders.status })
			.from(schema.sellerOrders)
			.where(eq(schema.sellerOrders.orderId, order.id))
		const fully = siblings.every(
			(row) => row.status === 'refunded' || row.status === 'canceled',
		)
		await tx
			.update(schema.orders)
			.set({ status: fully ? 'refunded' : 'partially_refunded', updatedAt: new Date() })
			.where(eq(schema.orders.id, order.id))
		await logTransaction(
			{
				...base,
				type: 'refund.created',
				stripeObjectId: refund.id,
				amountCents,
				status: refund.status ?? 'succeeded',
			},
			tx,
		)
		return true
	})
	if (!refunded) return

	if (sellerOrder.stripeTransferId && sellerOrder.payoutCents > 0) {
		const reversal = { ...base, amountCents: sellerOrder.payoutCents }
		try {
			const result = await stripe.transfers.createReversal(
				sellerOrder.stripeTransferId,
				{ amount: sellerOrder.payoutCents, metadata: { sellerOrderId: sellerOrder.id } },
				{ idempotencyKey: `reversal-${sellerOrder.id}` },
			)
			await logTransaction({
				...reversal,
				type: 'transfer.reversed',
				stripeObjectId: result.id,
				status: 'succeeded',
			})
		} catch (error) {
			// The buyer is already refunded; the platform carries the loss until this is settled
			// by hand (D1: platform bears refund liability first).
			await logTransaction({
				...reversal,
				type: 'transfer.reversal_failed',
				stripeObjectId: sellerOrder.stripeTransferId,
				status: 'failed',
				payload: { message: error instanceof Error ? error.message : String(error) },
			})
		}
	}

	await notifyBuyer(
		order.id,
		'you got a refund on resell.sh',
		`a seller refunded ${formatMoney(amountCents)} of your order. it goes back to your original payment method, usually within 5–10 business days.`,
	)
}

// `charge.refunded` fires for our own refunds (already logged by refundSellerOrder) and for refunds made in
// the Stripe Dashboard. Only the part of `amount_refunded` the ledger doesn't know yet is logged, so our
// refunds and re-deliveries add nothing. ponytail: logs only, the order status isn't changed; an admin
// reconciles from /admin/transaction-logs.
export async function recordExternalRefund(charge: Stripe.Charge): Promise<void> {
	const paymentIntentId =
		typeof charge.payment_intent === 'string'
			? charge.payment_intent
			: charge.payment_intent?.id
	if (!paymentIntentId) return
	const [order] = await db
		.select({ id: schema.orders.id, buyerId: schema.orders.buyerId })
		.from(schema.orders)
		.where(eq(schema.orders.stripePaymentIntentId, paymentIntentId))
	if (!order) return
	const [logged] = await db
		.select({ cents: sql<number>`coalesce(sum(${schema.transactionLogs.amountCents}), 0)` })
		.from(schema.transactionLogs)
		.where(
			and(
				eq(schema.transactionLogs.orderId, order.id),
				eq(schema.transactionLogs.type, 'refund.created'),
			),
		)
	const unknownCents = charge.amount_refunded - Number(logged?.cents ?? 0)
	if (unknownCents <= 0) return
	await logTransaction({
		type: 'refund.created',
		orderId: order.id,
		userId: order.buyerId,
		stripeObjectId: charge.id,
		amountCents: unknownCents,
		status: 'succeeded',
		payload: { source: 'stripe_dashboard', amountRefunded: charge.amount_refunded },
	})
}
