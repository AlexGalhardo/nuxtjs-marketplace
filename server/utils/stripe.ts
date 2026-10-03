import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

let client: Stripe | undefined

// Lazily constructed so a dev/test environment without Stripe keys can still boot and serve
// every route that doesn't touch Stripe; only the handlers that call this throw (A10: fail
// closed with a clear error instead of crashing at startup or silently no-op-ing).
export function getStripeClient(): Stripe {
	const config = useRuntimeConfig()
	if (!config.stripe.secretKey) {
		throw createError({ statusCode: 501, statusMessage: 'Stripe is not configured' })
	}
	if (!client) {
		const base = config.stripe.apiBase ? new URL(config.stripe.apiBase) : undefined
		client = new Stripe(config.stripe.secretKey, {
			...(base && {
				host: base.hostname,
				port: Number(base.port),
				protocol: base.protocol.replace(':', '') as 'http' | 'https',
			}),
		})
	}
	return client
}

// A seller can sell once their account can receive transfers (Accounts v2 recipient capability). Called by
// the `account.updated` webhook and when the seller returns from onboarding, so the shop doesn't wait on a
// webhook. Returns whether the account is ready.
export async function syncShopStripeStatus(stripeAccountId: string): Promise<boolean> {
	const account = await getStripeClient().v2.core.accounts.retrieve(stripeAccountId, {
		include: ['configuration.recipient'],
	})
	const ready =
		account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ===
		'active'
	await db
		.update(schema.shops)
		.set({ chargesEnabled: ready, payoutsEnabled: ready })
		.where(eq(schema.shops.stripeAccountId, stripeAccountId))
	return ready
}
