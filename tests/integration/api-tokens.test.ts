import { fetch } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import { dbQuery } from './helpers/db'

// Phase 10 (D14): personal API tokens, Bearer auth with per-route scopes, per-token rate limit,
// and the public OpenAPI spec.
const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
let cookie = ''

function call(path: string, init: { method?: string; body?: unknown; auth?: string } = {}) {
	return fetch(path, {
		method: init.method ?? 'GET',
		headers: {
			'content-type': 'application/json',
			...(init.auth ? { authorization: init.auth } : { cookie }),
		},
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	})
}

async function createToken(body: object) {
	const response = await call('/api/v1/shop/tokens', { method: 'POST', body })
	expect(response.status).toBe(201)
	return (await response.json()) as { id: string; token: string; prefix: string }
}

beforeAll(async () => {
	const signup = await fetch('/api/auth/signup', {
		method: 'POST',
		body: JSON.stringify({
			name: 'token tester',
			email: `tokens-${run}@example.com`,
			password: 'Ab1!Ab1!',
		}),
		headers: { 'content-type': 'application/json' },
	})
	cookie = signup.headers.get('set-cookie')?.split(';')[0] ?? ''
})

describe('token management', () => {
	it('needs a shop first', async () => {
		const response = await call('/api/v1/shop/tokens', {
			method: 'POST',
			body: { name: 'early', scopes: ['products:read'] },
		})
		expect(response.status).toBe(409)
		await call('/api/v1/shop', {
			method: 'POST',
			body: { name: 'Token Shop', slug: `token-shop-${run}` },
		})
	})

	it('shows the secret once and never stores or lists it', async () => {
		const created = await createToken({ name: 'sync', scopes: ['products:read'] })
		expect(created.token).toMatch(/^rs_[0-9a-f]{8}_[0-9a-f]{48}$/)
		expect(created.token.startsWith(`${created.prefix}_`)).toBe(true)
		expect(created).not.toHaveProperty('tokenHash')

		const list = (await (await call('/api/v1/shop/tokens')).json()) as Record<string, unknown>[]
		expect(list.find((row) => row.id === created.id)).toMatchObject({
			name: 'sync',
			scopes: ['products:read'],
		})
		expect(JSON.stringify(list)).not.toContain(created.token)
		const [stored] = dbQuery<{ tokenHash: string }[]>(`
			return db.select().from(schema.apiTokens).where(eq(schema.apiTokens.id, '${created.id}'))
		`)
		expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/)
		expect(stored?.tokenHash).not.toBe(created.token)
	})

	it('rejects invalid scopes and unauthenticated calls', async () => {
		const bad = await call('/api/v1/shop/tokens', {
			method: 'POST',
			body: { name: 'x', scopes: ['admin:write'] },
		})
		expect(bad.status).toBe(400)
		const guest = await fetch('/api/v1/shop/tokens')
		expect(guest.status).toBe(401)
	})
})

describe('bearer auth', () => {
	let readOnly = ''
	let full = ''

	beforeAll(async () => {
		readOnly = (await createToken({ name: 'reader', scopes: ['products:read'] })).token
		full = (
			await createToken({
				name: 'writer',
				scopes: ['shop:read', 'products:read', 'products:write', 'orders:read'],
				expiresInDays: null,
			})
		).token
	})

	it('grants exactly the scoped routes', async () => {
		expect((await call('/api/v1/shop/products', { auth: `Bearer ${readOnly}` })).status).toBe(
			200,
		)
		const write = await call('/api/v1/shop/products', {
			method: 'POST',
			auth: `Bearer ${readOnly}`,
			body: {},
		})
		expect(write.status).toBe(403)
		expect((await call('/api/v1/shop/orders', { auth: `Bearer ${readOnly}` })).status).toBe(403)
		expect((await call('/api/v1/shop/orders', { auth: `Bearer ${full}` })).status).toBe(200)
		const shop = await call('/api/v1/shop', { auth: `Bearer ${full}` })
		expect(((await shop.json()) as { slug: string }).slug).toBe(`token-shop-${run}`)
	})

	it('acts as the token owner when writing', async () => {
		const types = (await (await fetch('/api/product-types')).json()) as {
			id: string
			kind: string
		}[]
		const created = await call('/api/v1/shop/products', {
			method: 'POST',
			auth: `Bearer ${full}`,
			body: {
				productTypeId: types.find((type) => type.kind === 'digital')?.id,
				title: 'api made',
				slug: `api-made-${run}`,
				description: 'Created through a bearer token.',
				priceCents: 500,
			},
		})
		expect(created.status).toBe(200)
	})

	it('is refused outside the seller API and for token management', async () => {
		expect((await call('/api/profile', { auth: `Bearer ${full}` })).status).toBe(403)
		expect((await call('/api/cart', { auth: `Bearer ${full}` })).status).toBe(403)
		expect((await call('/api/v1/shop/tokens', { auth: `Bearer ${full}` })).status).toBe(403)
		// Path variants must not dodge the route-based scope check.
		for (const path of [
			'/api/v1/shop//tokens',
			'/api/v1/shop/tokens/',
			'/api/v1//shop/tokens',
		]) {
			expect((await call(path, { auth: `Bearer ${full}` })).status).not.toBe(200)
		}
	})

	it('rejects unknown, revoked and expired tokens', async () => {
		expect((await call('/api/v1/shop/products', { auth: 'Bearer rs_nope_nope' })).status).toBe(
			401,
		)

		const revoked = await createToken({ name: 'revoke me', scopes: ['products:read'] })
		expect((await call(`/api/v1/shop/tokens/${revoked.id}`, { method: 'DELETE' })).status).toBe(
			204,
		)
		expect(
			(await call('/api/v1/shop/products', { auth: `Bearer ${revoked.token}` })).status,
		).toBe(401)

		const expired = await createToken({ name: 'old', scopes: ['products:read'] })
		dbQuery(`
			await db.update(schema.apiTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.apiTokens.id, '${expired.id}'))
		`)
		expect(
			(await call('/api/v1/shop/products', { auth: `Bearer ${expired.token}` })).status,
		).toBe(401)
	})

	it('rate-limits each token', async () => {
		const token = (await createToken({ name: 'burst', scopes: ['shop:read'] })).token
		const statuses: number[] = []
		for (let index = 0; index < 121; index += 1) {
			statuses.push((await call('/api/v1/shop', { auth: `Bearer ${token}` })).status)
		}
		expect(statuses.slice(0, 120).every((status) => status === 200)).toBe(true)
		const limited = await call('/api/v1/shop', { auth: `Bearer ${token}` })
		expect(limited.status).toBe(429)
		expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
		// Other tokens have their own window.
		expect((await call('/api/v1/shop', { auth: `Bearer ${full}` })).status).toBe(200)
	})
})

describe('openapi', () => {
	it('documents every seller API operation with its token scope', async () => {
		const response = await fetch('/api/v1/openapi.json')
		expect(response.status).toBe(200)
		const spec = (await response.json()) as {
			openapi: string
			components: { securitySchemes: Record<string, unknown> }
			paths: Record<
				string,
				Record<
					string,
					{ summary: string; 'x-token-scope': string | null; requestBody?: unknown }
				>
			>
		}
		expect(spec.openapi).toBe('3.1.0')
		expect(spec.components.securitySchemes).toHaveProperty('bearerAuth')
		const operations = Object.entries(spec.paths)
			.flatMap(([path, methods]) =>
				Object.entries(methods).map(
					([method, operation]) =>
						`${method.toUpperCase()} ${path} ${operation['x-token-scope'] ?? 'session-only'}`,
				),
			)
			.sort()
		expect(operations).toMatchSnapshot()
		expect(spec.paths['/api/v1/shop/products']?.post?.requestBody).toMatchObject({
			content: {
				'application/json': { schema: { required: expect.arrayContaining(['title']) } },
			},
		})
	})

	it('keeps Nitro’s full internal route list private in production', async () => {
		expect((await fetch('/_openapi.json')).status).toBe(404)
	})
})
