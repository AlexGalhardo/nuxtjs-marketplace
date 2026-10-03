import { readdirSync } from 'node:fs'
import type { APIRequestContext } from '@playwright/test'
import { LOAD_ADMIN_EMAIL } from '../../server/db/seed-load'
import {
	checkout,
	dbQuery,
	expect,
	listProduct,
	logIn,
	makeBuyer,
	makeSeller,
	newApi,
	ok,
	type Playwright,
	pay,
	type Seller,
	sellerOrderOf,
	signUp,
	test,
} from './helpers'

// AuthZ matrix: every route under server/api × every kind of caller → the status class it must get.
// Routes are read from the file system, so a new endpoint is checked automatically and fails until it is
// classified below. Ids are random (nothing to find): this proves the gate, IDOR tests below use real rows.

type Access = 'public' | 'user' | 'admin' | 'shop-api'

const PUBLIC = [
	/^\/api\/health$/,
	/^\/api\/product-types$/,
	/^\/api\/products(\/|$)/,
	/^\/api\/shops\//,
	/^\/api\/v1\/openapi\.json$/,
	/^\/api\/auth\/(login|signup|logout|forgot-password|reset-password)$/,
	/^\/api\/contact$/,
	/^\/api\/stripe\/webhook$/,
]

function accessOf(path: string): Access {
	if (PUBLIC.some((pattern) => pattern.test(path))) return 'public'
	if (path.startsWith('/api/admin/')) return 'admin'
	// D14: the seller API takes Bearer tokens, except token management and Stripe onboarding.
	if (/^\/api\/v1\/shop(\/|$)/.test(path) && !/^\/api\/v1\/shop\/(tokens|stripe)/.test(path)) {
		return 'shop-api'
	}
	return 'user'
}

const scopes = [
	'shop:read',
	'shop:write',
	'products:read',
	'products:write',
	'orders:read',
	'orders:write',
]
// The scope a token needs, by resource and verb (docs/rest-api.md).
const scopeFor = (method: string, path: string): string => {
	const resource = path.split('/')[4]
	const area = resource === 'products' || resource === 'orders' ? resource : 'shop'
	return `${area}:${method === 'GET' ? 'read' : 'write'}`
}

const missing = '00000000-0000-7000-8000-000000000000'
const endpoints = (readdirSync('server/api', { recursive: true }) as string[])
	.map((file) => file.replace(/\\/g, '/'))
	.filter((file) => /\.(get|post|put|patch|delete)\.ts$/.test(file))
	.map((file) => {
		const [, route = '', method = ''] =
			file.match(/^(.*)\.(get|post|put|patch|delete)\.ts$/) ?? []
		const pattern = `/api/${route}`.replace(/\/index$/, '')
		const path = pattern
			.replace('[kind]', 'logo')
			.replace('[slug]', 'no-such-slug')
			.replace(/\[[^\]]+\]/g, missing)
		return { method: method.toUpperCase(), pattern, path, access: accessOf(pattern) }
	})

async function call(api: APIRequestContext, method: string, path: string): Promise<number> {
	const response = await api.fetch(path, { method, ...(method === 'GET' ? {} : { data: {} }) })
	return response.status()
}

async function bearer(playwright: Playwright, token: string): Promise<APIRequestContext> {
	return newApi(playwright, { authorization: `Bearer ${token}` })
}

test('the matrix covers every API route', () => {
	expect(endpoints.length).toBeGreaterThan(60)
	expect(new Set(endpoints.map((endpoint) => endpoint.access))).toEqual(
		new Set(['public', 'user', 'admin', 'shop-api']),
	)
})

test('guest: public routes answer, everything else is 401', async ({ playwright }) => {
	const guest = await newApi(playwright)
	const wrong: string[] = []
	for (const { method, path, pattern, access } of endpoints) {
		const status = await call(guest, method, path)
		const expected =
			access === 'public' ? status < 500 && status !== 401 && status !== 403 : status === 401
		if (!expected) wrong.push(`${method} ${pattern} → ${status}`)
	}
	expect(wrong).toEqual([])
})

for (const actor of ['buyer', 'seller', 'admin'] as const) {
	test(`${actor} session: admin routes are ${actor === 'admin' ? 'open' : '403'}, the rest never 401/403/5xx`, async ({
		playwright,
	}) => {
		test.setTimeout(60_000)
		const session =
			actor === 'seller' ? (await makeSeller(playwright)).api : await newApi(playwright)
		if (actor === 'buyer') await signUp(session, 'buyer')
		if (actor === 'admin') await logIn(session, LOAD_ADMIN_EMAIL)
		const wrong: string[] = []
		for (const { method, path, pattern, access } of endpoints) {
			// Public auth routes would rate-limit or end this session; the guest test covers them.
			if (access === 'public') continue
			const status = await call(session, method, path)
			const denied = access === 'admin' && actor !== 'admin'
			const expected = denied
				? status === 403
				: status < 500 && status !== 401 && status !== 403
			if (!expected) wrong.push(`${method} ${pattern} → ${status}`)
		}
		expect(wrong).toEqual([])
	})
}

test('API tokens: each scope opens exactly its own routes, nothing outside the seller API', async ({
	playwright,
}) => {
	test.setTimeout(120_000)
	const seller = await makeSeller(playwright)
	const wrong: string[] = []
	for (const scope of scopes) {
		const { token } = await ok<{ token: string }>(
			await seller.api.post('/api/v1/shop/tokens', {
				data: { name: scope, scopes: [scope], expiresInDays: 30 },
			}),
		)
		const api = await bearer(playwright, token)
		for (const { method, path, pattern, access } of endpoints) {
			if (access === 'public') continue
			const status = await call(api, method, path)
			const allowed = access === 'shop-api' && scopeFor(method, pattern) === scope
			const expected = allowed
				? status < 500 && status !== 401 && status !== 403
				: status === 403
			if (!expected) wrong.push(`${scope}: ${method} ${pattern} → ${status}`)
		}
		// Revoke as we go: a seller holds a capped number of active tokens.
		const tokens = await ok<{ id: string; name: string }[]>(
			await seller.api.get('/api/v1/shop/tokens'),
		)
		await ok(
			await seller.api.delete(
				`/api/v1/shop/tokens/${tokens.find((entry) => entry.name === scope)?.id}`,
			),
		)
		expect(await call(api, 'GET', '/api/v1/shop')).toBe(401)
	}
	expect(wrong).toEqual([])
})

test('forged, expired and malformed bearer tokens are 401', async ({ playwright }) => {
	const seller = await makeSeller(playwright)
	const { token, id } = await ok<{ token: string; id: string }>(
		await seller.api.post('/api/v1/shop/tokens', {
			data: { name: 'soon expired', scopes: ['shop:read'], expiresInDays: 30 },
		}),
	)
	dbQuery(
		`await db.update(schema.apiTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.apiTokens.id, ${JSON.stringify(id)}))`,
	)
	for (const value of [token, `${token}x`, 'rs_0000_forged', "' OR 1=1 --", 'a'.repeat(5000)]) {
		const api = await bearer(playwright, value)
		expect(await call(api, 'GET', '/api/v1/shop'), value.slice(0, 20)).toBe(401)
	}
})

async function twoSellers(playwright: Playwright): Promise<[Seller, Seller]> {
	return [await makeSeller(playwright), await makeSeller(playwright)]
}

test('IDOR: another seller cannot read or change my products, orders or tokens', async ({
	playwright,
}) => {
	const [alice, mallory] = await twoSellers(playwright)
	const product = await listProduct(alice, 'physical')
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[product.id]])
	await pay(buyer.api, orderId)
	const sellerOrderId = sellerOrderOf(orderId, alice.shopId)
	const { id: tokenId } = await ok<{ id: string }>(
		await alice.api.post('/api/v1/shop/tokens', {
			data: { name: 'alice', scopes: ['shop:read'] },
		}),
	)
	const { token: malloryToken } = await ok<{ token: string }>(
		await mallory.api.post('/api/v1/shop/tokens', {
			data: {
				name: 'mallory',
				scopes: ['products:read', 'products:write', 'orders:read', 'orders:write'],
			},
		}),
	)
	const malloryBearer = await bearer(playwright, malloryToken)

	for (const api of [mallory.api, malloryBearer]) {
		const base = `/api/v1/shop/products/${product.id}`
		expect((await api.get(base)).status()).toBe(403)
		expect((await api.patch(base, { data: { title: 'pwned product' } })).status()).toBe(403)
		expect((await api.post(`${base}/archive`)).status()).toBe(403)
		expect((await api.get(`${base}/images`)).status()).toBe(403)
		expect((await api.delete(base)).status()).toBe(403)
		const order = `/api/v1/shop/orders/${sellerOrderId}`
		expect(
			(
				await api.post(`${order}/ship`, { data: { carrier: 'x', trackingCode: 'y' } })
			).status(),
		).toBe(404)
		expect((await api.post(`${order}/refund`)).status()).toBe(404)
		expect((await api.post(`${order}/deliver`)).status()).toBe(404)
		const listed = await ok<{ items?: { id: string }[] }>(await api.get('/api/v1/shop/orders'))
		expect(JSON.stringify(listed)).not.toContain(sellerOrderId)
	}
	expect((await mallory.api.delete(`/api/v1/shop/tokens/${tokenId}`)).status()).toBe(404)
	expect(JSON.stringify(await ok(await mallory.api.get('/api/v1/shop/tokens')))).not.toContain(
		tokenId,
	)

	// Mass assignment: a shopId in the body never moves the product into someone else's shop.
	const created = await ok<{ id: string; shopId: string }>(
		await mallory.api.post('/api/v1/shop/products', {
			data: {
				productTypeId: (
					await ok<{ id: string; kind: string }[]>(
						await mallory.api.get('/api/product-types'),
					)
				)[0]?.id,
				title: 'mallory product',
				slug: `mallory-${Date.now()}`,
				description: 'trying to post into alice shop',
				priceCents: 100,
				shopId: alice.shopId,
				status: 'published',
				ratingAvg: 5,
			},
		}),
	)
	expect(created.shopId).toBe(mallory.shopId)
	expect(
		dbQuery<string>(
			`return (await db.select({ s: schema.products.status }).from(schema.products).where(eq(schema.products.id, ${JSON.stringify(created.id)})))[0].s`,
		),
	).toBe('draft')

	// Still intact for the owner, and the admin can see it (moderation).
	expect(
		(await ok<{ title: string }>(await alice.api.get(`/api/v1/shop/products/${product.id}`)))
			.title,
	).not.toBe('pwned product')
	const admin = await newApi(playwright)
	await logIn(admin, LOAD_ADMIN_EMAIL)
	expect((await admin.get(`/api/v1/shop/products/${product.id}`)).status()).toBe(200)
})

test('IDOR: another buyer cannot see or use my orders, addresses or order items', async ({
	playwright,
}) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical')
	const alice = await makeBuyer(playwright)
	const mallory = await makeBuyer(playwright)
	const orderId = await checkout(alice, [[product.id]])
	await pay(alice.api, orderId)
	const orderItemId = dbQuery<string>(`
    const [row] = await db.select({ id: schema.orderItems.id }).from(schema.orderItems)
      .innerJoin(schema.sellerOrders, eq(schema.orderItems.sellerOrderId, schema.sellerOrders.id))
      .where(eq(schema.sellerOrders.orderId, ${JSON.stringify(orderId)}))
    return row.id
  `)

	expect((await mallory.api.get(`/api/orders/${orderId}`)).status()).toBe(404)
	expect(JSON.stringify(await ok(await mallory.api.get('/api/orders')))).not.toContain(orderId)
	const address = `/api/profile/addresses/${alice.addressId}`
	expect(
		(
			await mallory.api.patch(address, {
				data: {
					fullName: 'x',
					line1: 'x',
					city: 'x',
					state: 'x',
					postalCode: '1',
					country: 'US',
					phone: '1',
				},
			})
		).status(),
	).toBe(404)
	expect((await mallory.api.delete(address)).status()).toBe(404)
	expect(JSON.stringify(await ok(await mallory.api.get('/api/profile/addresses')))).not.toContain(
		alice.addressId,
	)
	expect(
		(
			await mallory.api.post('/api/reviews', {
				data: { orderItemId, rating: 1, comment: 'not mine' },
			})
		).status(),
	).toBe(404)
	// Checking out to someone else's address.
	await ok(await mallory.api.post('/api/cart/items', { data: { productId: product.id } }))
	expect(
		(
			await mallory.api.post('/api/checkout', { data: { addressId: alice.addressId } })
		).status(),
	).toBe(404)
	// Profile endpoints only ever answer about the caller.
	expect(
		(await ok<{ user: { email: string } }>(await mallory.api.get('/api/profile'))).user.email,
	).toBe(mallory.email)
})
