import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import { dbQuery } from './helpers/db'
import { FAKE_STRIPE_PORT, type RecordedRequest } from './helpers/fake-stripe'
import { postWebhook } from './helpers/webhook'

const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
let cookie = ''
let shopId = ''

function shopState() {
	return dbQuery<{ stripeAccountId: string | null; chargesEnabled: boolean }[]>(`
		return db.select({ stripeAccountId: schema.shops.stripeAccountId, chargesEnabled: schema.shops.chargesEnabled }).from(schema.shops).where(eq(schema.shops.id, '${shopId}'))
	`)[0]
}

beforeAll(async () => {
	const response = await fetch('/api/auth/signup', {
		method: 'POST',
		body: JSON.stringify({
			name: 'connect tester',
			email: `connect-${run}@example.com`,
			password: 'Ab1!Ab1!',
		}),
		headers: { 'content-type': 'application/json' },
	})
	cookie = response.headers.get('set-cookie')?.split(';')[0] ?? ''
	const shop = await $fetch<{ id: string }>('/api/v1/shop', {
		method: 'POST',
		headers: { cookie },
		body: { name: 'Connect Shop', slug: `connect-${run}` },
	})
	shopId = shop.id
})

describe('stripe connect onboarding (accounts v2)', () => {
	it('creates a v2 recipient account once and returns an onboarding link', async () => {
		const first = await $fetch<{ url: string }>('/api/v1/shop/stripe/onboarding', {
			method: 'POST',
			headers: { cookie },
		})
		const second = await $fetch<{ url: string }>('/api/v1/shop/stripe/onboarding', {
			method: 'POST',
			headers: { cookie },
		})
		expect(first.url).toMatch(/^https:\/\/connect\.stripe\.test\//)
		expect(second.url).not.toBe(first.url)

		const requests = (await (
			await globalThis.fetch(`http://127.0.0.1:${FAKE_STRIPE_PORT}/__requests`)
		).json()) as RecordedRequest[]
		const created = requests.filter(
			(r) => r.path === '/v2/core/accounts' && r.body.json?.includes(`connect-${run}@`),
		)
		expect(created).toHaveLength(1)
		expect(JSON.parse(created[0]?.body.json ?? '{}')).toMatchObject({
			dashboard: 'express',
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
		})
		expect(shopState()?.stripeAccountId).toMatch(/^acct_fake_/)
		expect(shopState()?.chargesEnabled).toBe(false)
	})

	it('enables selling from the v2 capability, on return and on account.updated', async () => {
		const ready = await $fetch<{ ready: boolean }>('/api/v1/shop/stripe/sync', {
			method: 'POST',
			headers: { cookie },
		})
		expect(ready).toEqual({ ready: true })
		expect(shopState()?.chargesEnabled).toBe(true)

		// The account loses the capability: the webhook reads v2, not v1 `charges_enabled`.
		dbQuery(
			`await db.update(schema.shops).set({ stripeAccountId: 'acct_restricted' }).where(eq(schema.shops.id, '${shopId}'))`,
		)
		const event = {
			id: `evt_account_${run}`,
			type: 'account.updated',
			data: { object: { id: 'acct_restricted', object: 'account', charges_enabled: true } },
		}
		expect((await postWebhook(event)).status).toBe(200)
		expect(shopState()?.chargesEnabled).toBe(false)
	})

	it('requires a session', async () => {
		const anonymous = await fetch('/api/v1/shop/stripe/sync', { method: 'POST' })
		expect(anonymous.status).toBe(401)
	})
})
