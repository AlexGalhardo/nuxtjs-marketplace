import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

interface ShopResponse {
	id: string
	name: string
	slug: string
	ownerId: string
	chargesEnabled: boolean
}

function uniqueEmail() {
	return `shop-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

function extractSessionCookie(response: Response) {
	const setCookie = response.headers.get('set-cookie')
	if (!setCookie) throw new Error('Expected a Set-Cookie header')
	return setCookie.split(';')[0] as string
}

async function signUpAndGetCookie(email: string) {
	const response = await fetch('/api/auth/signup', {
		method: 'POST',
		body: JSON.stringify({ name: 'Shop Test', email, password: 'Ab1!Ab1!' }),
		headers: { 'content-type': 'application/json' },
	})
	return extractSessionCookie(response)
}

function uniqueSlug() {
	return `shop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

describe('shop endpoints', () => {
	it('rejects unauthenticated access', async () => {
		const response = await fetch('/api/v1/shop')
		expect(response.status).toBe(401)
	})

	it('returns null when the user has no shop yet', async () => {
		const cookie = await signUpAndGetCookie(uniqueEmail())
		const shop = await $fetch('/api/v1/shop', { headers: { cookie } })
		expect(shop).toBeNull()
	})

	it('creates, reads and updates a shop', async () => {
		const cookie = await signUpAndGetCookie(uniqueEmail())
		const slug = uniqueSlug()

		const created = await $fetch<ShopResponse>('/api/v1/shop', {
			method: 'POST',
			headers: { cookie },
			body: { name: 'Alex Shop', slug, description: 'Cool stuff' },
		})
		expect(created.slug).toBe(slug)
		expect(created.chargesEnabled).toBe(false)

		const fetched = await $fetch<ShopResponse>('/api/v1/shop', { headers: { cookie } })
		expect(fetched.id).toBe(created.id)

		const updated = await $fetch<ShopResponse>('/api/v1/shop', {
			method: 'PATCH',
			headers: { cookie },
			body: { name: 'Renamed Shop', description: 'Updated' },
		})
		expect(updated.name).toBe('Renamed Shop')
		expect(updated.slug).toBe(slug)
	})

	it('rejects creating a second shop for the same user', async () => {
		const cookie = await signUpAndGetCookie(uniqueEmail())
		await $fetch('/api/v1/shop', {
			method: 'POST',
			headers: { cookie },
			body: { name: 'First Shop', slug: uniqueSlug() },
		})

		const response = await fetch('/api/v1/shop', {
			method: 'POST',
			headers: { cookie, 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Second Shop', slug: uniqueSlug() }),
		})
		expect(response.status).toBe(409)
	})

	it('rejects a shop slug that is already taken', async () => {
		const cookieA = await signUpAndGetCookie(uniqueEmail())
		const cookieB = await signUpAndGetCookie(uniqueEmail())
		const slug = uniqueSlug()

		await $fetch('/api/v1/shop', {
			method: 'POST',
			headers: { cookie: cookieA },
			body: { name: 'First Shop', slug },
		})

		const response = await fetch('/api/v1/shop', {
			method: 'POST',
			headers: { cookie: cookieB, 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Second Shop', slug }),
		})
		expect(response.status).toBe(409)
	})
})
