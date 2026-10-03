import { eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['shop'],
		summary: 'Start Stripe Connect onboarding',
		description: 'Session cookie only. Returns a one-time Stripe account link `url`.',
	},
})

// Creates (or reuses) the shop's Stripe connected account (Accounts v2: Express dashboard, the platform
// collects fees and owns losses, recipient configuration with `stripe_transfers` — the separate charges and
// transfers model, D1) and returns a fresh onboarding link. D12: publishing a product requires the
// `stripe_transfers` capability to be active (`shops.charges_enabled`), synced by `syncShopStripeStatus()`.
export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, user.id))
	if (!shop) {
		throw createError({ statusCode: 404, statusMessage: 'Shop not found' })
	}

	const stripe = getStripeClient()
	const config = useRuntimeConfig()

	// A10: a Stripe outage or error is a 502 with a safe message, never a raw 500.
	try {
		let stripeAccountId = shop.stripeAccountId
		if (!stripeAccountId) {
			const account = await stripe.v2.core.accounts.create({
				contact_email: user.email,
				display_name: shop.name,
				dashboard: 'express',
				// USD-only marketplace (D4): sellers onboard as US recipients.
				identity: { country: 'us' },
				defaults: {
					responsibilities: {
						fees_collector: 'application',
						losses_collector: 'application',
					},
				},
				configuration: {
					recipient: {
						capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
					},
				},
				metadata: { shopId: shop.id },
			})
			stripeAccountId = account.id
			await db
				.update(schema.shops)
				.set({ stripeAccountId })
				.where(eq(schema.shops.id, shop.id))
		}

		const accountLink = await stripe.v2.core.accountLinks.create({
			account: stripeAccountId,
			use_case: {
				type: 'account_onboarding',
				account_onboarding: {
					configurations: ['recipient'],
					refresh_url: `${config.public.siteUrl}/my-shop/payouts/refresh`,
					return_url: `${config.public.siteUrl}/my-shop/payouts/return`,
				},
			},
		})
		return { url: accountLink.url }
	} catch {
		throw createError({
			statusCode: 502,
			statusMessage: 'Payment provider is unavailable, try again',
		})
	}
})
