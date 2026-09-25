import { fetch } from '@nuxt/test-utils/e2e'
import Stripe from 'stripe'

// Must match NUXT_STRIPE_WEBHOOK_SECRET in ../global-setup.ts.
const WEBHOOK_SECRET = 'whsec_test_integration'
const stripe = new Stripe('sk_test_fake')

export async function postWebhook(
	event: { id: string; type: string; data: { object: unknown } },
	secret = WEBHOOK_SECRET,
) {
	const payload = JSON.stringify({ object: 'event', api_version: '2026-01-01', ...event })
	return fetch('/api/stripe/webhook', {
		method: 'POST',
		body: payload,
		headers: {
			'content-type': 'application/json',
			'stripe-signature': await stripe.webhooks.generateTestHeaderStringAsync({
				payload,
				secret,
			}),
		},
	})
}
