import { fetch, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const post = (path: string, headers: Record<string, string> = {}) =>
	fetch(path, { method: 'POST', headers, redirect: 'manual' })

describe('cross-site request forgery guard', () => {
	it('refuses a mutation sent from another origin', async () => {
		const response = await post('/api/auth/logout', { origin: 'https://evil.example' })
		expect(response.status).toBe(403)
	})

	it('falls back to the referer when there is no origin', async () => {
		const response = await post('/api/auth/logout', { referer: 'https://evil.example/page' })
		expect(response.status).toBe(403)
	})

	it('allows same-origin browser requests', async () => {
		const response = await post('/api/auth/logout', { origin: new URL(url('/')).origin })
		expect(response.status).toBe(200)
	})

	it('allows non-browser clients that send neither header', async () => {
		expect((await post('/api/auth/logout')).status).toBe(200)
	})

	it('leaves safe methods alone', async () => {
		const response = await fetch('/api/health', { headers: { origin: 'https://evil.example' } })
		expect(response.status).toBe(200)
	})

	it('skips bearer-token requests and the Stripe webhook (no cookies involved)', async () => {
		const bearer = await post('/api/v1/shop/products', {
			origin: 'https://evil.example',
			authorization: 'Bearer rs_nope_nope',
		})
		expect(bearer.status).toBe(401)
		const webhook = await post('/api/stripe/webhook', { origin: 'https://evil.example' })
		expect(webhook.status).not.toBe(403)
	})
})
