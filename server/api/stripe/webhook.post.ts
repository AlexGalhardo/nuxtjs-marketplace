import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'

// Signature-verified (A08), idempotent via stripe_events. An event only counts as done once
// processed_at is set: if a handler throws, Stripe retries it and it runs again (handlers are
// themselves safe to repeat). docs/payments-stripe.md lists the events.
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
	// Comma-separated: the platform endpoint and the Connect endpoint (connected accounts' events, e.g.
	// account.updated) each have their own signing secret (scripts/stripe-bootstrap.ts).
	let stripeEvent: Stripe.Event | undefined
	for (const secret of config.stripe.webhookSecret.split(',').map((s) => s.trim())) {
		try {
			// Async on purpose: under Bun, stripe loads its worker build (SubtleCrypto), whose sync
			// constructEvent always throws, so every event would be rejected as a bad signature.
			stripeEvent = await stripe.webhooks.constructEventAsync(rawBody, signature, secret)
			break
		} catch {}
	}
	if (!stripeEvent) {
		throw createError({ statusCode: 400, statusMessage: 'Invalid webhook signature' })
	}

	const [existing] = await db
		.select({ processedAt: schema.stripeEvents.processedAt })
		.from(schema.stripeEvents)
		.where(eq(schema.stripeEvents.id, stripeEvent.id))
	if (existing?.processedAt) {
		return { received: true }
	}
	if (!existing) {
		await db
			.insert(schema.stripeEvents)
			.values({
				id: stripeEvent.id,
				type: stripeEvent.type,
				payload: stripeEvent as unknown as Record<string, unknown>,
			})
			.onConflictDoNothing()
	}

	switch (stripeEvent.type) {
		case 'checkout.session.completed':
		case 'checkout.session.async_payment_succeeded':
			await fulfillCheckout(stripeEvent.data.object)
			break
		case 'checkout.session.expired':
		case 'checkout.session.async_payment_failed':
			await expireCheckout(stripeEvent.data.object)
			break
		case 'charge.dispute.created':
			await recordDispute(stripeEvent.data.object)
			break
		case 'charge.dispute.closed':
			await recordDispute(stripeEvent.data.object, 'dispute.closed')
			break
		case 'charge.refunded':
			await recordExternalRefund(stripeEvent.data.object)
			break
		case 'account.updated':
			// v1 `charges_enabled` stays false for recipient-only (v2) accounts, so read the v2 capability.
			await syncShopStripeStatus(stripeEvent.data.object.id)
			break
	}

	await db
		.update(schema.stripeEvents)
		.set({ processedAt: new Date() })
		.where(eq(schema.stripeEvents.id, stripeEvent.id))

	return { received: true }
})
