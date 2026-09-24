import { execFileSync } from 'node:child_process'

// Simulates the `account.updated` Stripe webhook (server/api/stripe/webhook.post.ts) marking a
// shop's Stripe onboarding complete, without needing real Stripe test-mode credentials.
// Subprocess rationale: see issueResetToken in ./reset-token.ts.
export function markShopChargesEnabled(shopId: string): void {
  const script = `
    import { eq } from 'drizzle-orm'
    import { closeSeedClient, createSeedClient } from './server/db/client'

    const { db, schema } = await createSeedClient()
    await db
      .update(schema.shops)
      .set({ chargesEnabled: true, payoutsEnabled: true })
      .where(eq(schema.shops.id, ${JSON.stringify(shopId)}))
    await closeSeedClient(db)
  `

  execFileSync('bun', ['-e', script], { cwd: process.cwd(), encoding: 'utf-8' })
}
