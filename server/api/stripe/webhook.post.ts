import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'

// Signature-verified, idempotent (stripe_events, A08). `account.updated` is the only event
// handled so far (Phase 6, seller onboarding); checkout/payment events land in Phase 8.
export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig()
	if (!config.stripe.webhookSecret) {
		throw createError({ statusCode: 501, statusMessage: 'Stripe webhook is not configured' })
	}

	const signature = getHeader(event, 'stripe-signature')
	const rawBody = await readRawBody(event)
	if (!signature || !rawBody) {
		throw createError({ statusCode: 400, statusMessage: 'Missing signature or body' })
	}

	const stripe = getStripeClient()
	let stripeEvent: Stripe.Event
	try {
		stripeEvent = stripe.webhooks.constructEvent(
			rawBody,
			signature,
			config.stripe.webhookSecret,
		)
	} catch {
		throw createError({ statusCode: 400, statusMessage: 'Invalid webhook signature' })
	}

	const [existing] = await db
		.select()
		.from(schema.stripeEvents)
		.where(eq(schema.stripeEvents.id, stripeEvent.id))
	if (existing) {
		return { received: true }
	}

	await db.insert(schema.stripeEvents).values({
		id: stripeEvent.id,
		type: stripeEvent.type,
		payload: stripeEvent as unknown as Record<string, unknown>,
	})

	if (stripeEvent.type === 'account.updated') {
		const account = stripeEvent.data.object as Stripe.Account
		await db
			.update(schema.shops)
			.set({
				chargesEnabled: Boolean(account.charges_enabled),
				payoutsEnabled: Boolean(account.payouts_enabled),
			})
			.where(eq(schema.shops.stripeAccountId, account.id))
	}

	await db
		.update(schema.stripeEvents)
		.set({ processedAt: new Date() })
		.where(eq(schema.stripeEvents.id, stripeEvent.id))

	return { received: true }
})
