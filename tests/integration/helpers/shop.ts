import { dbQuery } from './db'

// Simulates the `account.updated` Stripe webhook (server/api/stripe/webhook.post.ts) marking a
// shop's Stripe onboarding complete, without needing real Stripe test-mode credentials.
export function markShopChargesEnabled(shopId: string): void {
	dbQuery(`
    await db
      .update(schema.shops)
      .set({ chargesEnabled: true, payoutsEnabled: true })
      .where(eq(schema.shops.id, ${JSON.stringify(shopId)}))
  `)
}
