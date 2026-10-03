import { eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['shop'],
		summary: 'Refresh Stripe onboarding status',
		description:
			'Session cookie only. Re-reads the connected account from Stripe; returns `ready`.',
	},
})

// Called when the seller comes back from onboarding (`/my-shop/payouts/return`).
export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, user.id))
	if (!shop?.stripeAccountId) {
		throw createError({ statusCode: 404, statusMessage: 'Shop has no Stripe account yet' })
	}
	return { ready: await syncShopStripeStatus(shop.stripeAccountId) }
})
