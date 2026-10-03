import { eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['shop'],
		summary: 'Start Stripe Connect onboarding',
		description: 'Session cookie only. Returns a one-time Stripe account link `url`.',
	},
})

// Creates (or reuses) the shop's Stripe Express account and returns a fresh Account Link URL
// to redirect the seller to. D12: publishing a product requires `charges_enabled`, set by the
// `account.updated` webhook once onboarding completes (server/api/stripe/webhook.post.ts).
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
			const account = await stripe.accounts.create({
				type: 'express',
				email: user.email,
				capabilities: {
					card_payments: { requested: true },
					transfers: { requested: true },
				},
			})
			stripeAccountId = account.id
			await db
				.update(schema.shops)
				.set({ stripeAccountId })
				.where(eq(schema.shops.id, shop.id))
		}

		const accountLink = await stripe.accountLinks.create({
			account: stripeAccountId,
			type: 'account_onboarding',
			refresh_url: `${config.public.siteUrl}/my-shop/payouts/refresh`,
			return_url: `${config.public.siteUrl}/my-shop/payouts/return`,
		})
		return { url: accountLink.url }
	} catch {
		throw createError({
			statusCode: 502,
			statusMessage: 'Payment provider is unavailable, try again',
		})
	}
})
