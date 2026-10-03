import type { APIRequestContext, APIResponse, Page } from '@playwright/test'
import { LOAD_ADMIN_EMAIL } from '../../server/db/seed-load'
import {
	checkout,
	dbQuery,
	expect,
	ip,
	LEAK,
	listProduct,
	logIn,
	makeBuyer,
	makeSeller,
	newApi,
	ok,
	open,
	pay,
	sellerOrderOf,
	test,
	unique,
} from './helpers'

// Input fuzzing, API and UI: hostile, oversize, malformed and exotic input must end in a 4xx with a safe
// message (never a 5xx or a leaked stack/SQL), and whatever is stored must render as text, never as markup.

const XSS = '<img src=x onerror="window.__xss=1">'
const SCRIPT = '<script>window.__xss=1</script>'
const SVG = '<svg onload=alert(1)>'
const SQLI = [
	"' OR '1'='1",
	"'; DROP TABLE users; --",
	'" OR ""="',
	'1; SELECT * FROM users',
	"admin'--",
]
const UNICODE = ['日本語のテキスト', 'émoji 😀🔥 ✓', 'Ω≈ç√∫˜µ', '‮right-to-left', 'zero​width']
const HOSTILE: unknown[] = [
	null,
	'',
	'   ',
	12_345,
	true,
	{},
	[],
	['nested'],
	'x'.repeat(100_000),
	'\u0000null-byte',
	XSS,
	...SQLI,
	...UNICODE,
	-1,
	1.5,
	1e308,
	'1e999',
	'NaN',
	'Infinity',
]

async function safe(response: APIResponse, label: string): Promise<number> {
	const status = response.status()
	const body = await response.text()
	expect(status, `${label}: ${body.slice(0, 300)}`).toBeLessThan(500)
	// Echoed user data may contain anything; only error bodies must not leak internals.
	if (status >= 400) expect(body, label).not.toMatch(LEAK)
	return status
}

interface Target {
	method: 'POST' | 'PATCH' | 'PUT'
	path: string
	body: Record<string, unknown>
	as?: 'buyer' | 'seller' | 'admin'
	// Auth routes are rate-limited per IP: every request comes from its own address.
	fresh?: boolean
}

test('every field of every form endpoint survives hostile values without a 5xx or a leak', async ({
	playwright,
}) => {
	test.setTimeout(300_000)
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical')
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[product.id]])
	await pay(buyer.api, orderId)
	const admin = await newApi(playwright)
	await logIn(admin, LOAD_ADMIN_EMAIL)
	const sellerOrderId = sellerOrderOf(orderId, seller.shopId)
	const typeId = dbQuery<string>(
		'return (await db.select({ id: schema.productTypes.id }).from(schema.productTypes))[0].id',
	)

	const address = {
		fullName: 'qa',
		line1: '1 st',
		city: 'x',
		state: 'OR',
		postalCode: '97201',
		country: 'US',
		phone: '555',
	}
	const targets: Target[] = [
		{
			method: 'POST',
			path: '/api/auth/signup',
			body: { name: 'fuzz user', email: 'fuzz@qa.resell.test', password: 'Ab1!Ab1!' },
			fresh: true,
		},
		{
			method: 'POST',
			path: '/api/auth/login',
			body: { email: 'fuzz@qa.resell.test', password: 'Ab1!Ab1!' },
			fresh: true,
		},
		{
			method: 'POST',
			path: '/api/auth/forgot-password',
			body: { email: 'fuzz@qa.resell.test' },
			fresh: true,
		},
		{
			method: 'POST',
			path: '/api/auth/reset-password',
			body: { token: 'abc', password: 'Ab1!Ab1!' },
			fresh: true,
		},
		{
			method: 'POST',
			path: '/api/contact',
			body: {
				name: 'fuzz',
				email: 'fuzz@qa.resell.test',
				subject: 'fuzzing',
				message: 'fuzzing the contact form',
			},
			fresh: true,
		},
		{
			method: 'PATCH',
			path: '/api/profile',
			body: { name: 'fuzz buyer', phone: '555' },
			as: 'buyer',
		},
		{ method: 'POST', path: '/api/profile/addresses', body: address, as: 'buyer' },
		{
			method: 'PATCH',
			path: `/api/profile/addresses/${buyer.addressId}`,
			body: address,
			as: 'buyer',
		},
		{
			method: 'POST',
			path: '/api/cart/items',
			body: { productId: product.id, quantity: 1 },
			as: 'buyer',
		},
		{
			method: 'PATCH',
			path: `/api/cart/items/${product.id}`,
			body: { quantity: 1 },
			as: 'buyer',
		},
		{
			method: 'POST',
			path: '/api/checkout',
			body: { addressId: buyer.addressId },
			as: 'buyer',
		},
		{
			method: 'POST',
			path: '/api/reviews',
			body: { orderItemId: 'x', rating: 5, comment: 'ok' },
			as: 'buyer',
		},
		{
			method: 'PATCH',
			path: '/api/v1/shop',
			body: { name: 'fuzz shop', description: 'fuzz' },
			as: 'seller',
		},
		{
			method: 'POST',
			path: '/api/v1/shop/products',
			body: {
				productTypeId: typeId,
				title: 'fuzz product',
				slug: `fuzz-${unique()}`,
				description: 'fuzzing a product body',
				priceCents: 100,
				shippingCents: 0,
				stock: 1,
			},
			as: 'seller',
		},
		{
			method: 'PATCH',
			path: `/api/v1/shop/products/${product.id}`,
			body: { title: 'fuzz product', priceCents: 100 },
			as: 'seller',
		},
		{
			method: 'POST',
			path: `/api/v1/shop/orders/${sellerOrderId}/ship`,
			body: { carrier: 'usps', trackingCode: 'x' },
			as: 'seller',
		},
		{
			method: 'POST',
			path: '/api/v1/shop/tokens',
			body: { name: 'fuzz', scopes: ['shop:read'], expiresInDays: 30 },
			as: 'seller',
		},
		{
			method: 'PATCH',
			path: `/api/admin/shops/${seller.shopId}`,
			body: { status: 'active', reason: 'fuzz' },
			as: 'admin',
		},
		{
			method: 'PATCH',
			path: `/api/admin/products/${product.id}`,
			body: { status: 'published', reason: 'fuzz' },
			as: 'admin',
		},
	]
	const clients: Record<string, APIRequestContext> = {
		buyer: buyer.api,
		seller: seller.api,
		admin,
	}
	const guest = await newApi(playwright)

	let requests = 0
	for (const target of targets) {
		const api = target.as ? (clients[target.as] as APIRequestContext) : guest
		const send = (data: unknown, headers: Record<string, string> = {}) => {
			requests++
			return api.fetch(target.path, {
				method: target.method,
				data,
				headers: { ...(target.fresh ? { 'x-real-ip': ip() } : {}), ...headers },
			})
		}
		for (const field of Object.keys(target.body)) {
			for (const value of HOSTILE) {
				await safe(
					await send({ ...target.body, [field]: value }),
					`${target.method} ${target.path} ${field}=${String(value).slice(0, 30)}`,
				)
			}
			// Missing field.
			const { [field]: _dropped, ...rest } = target.body
			await safe(await send(rest), `${target.path} without ${field}`)
		}
		// Broken JSON, wrong content type, a body that isn't an object, and one over the size limit.
		await safe(
			await send('{"name": ', { 'content-type': 'application/json' }),
			`${target.path} broken json`,
		)
		await safe(
			await send('name=x', { 'content-type': 'text/plain' }),
			`${target.path} text/plain`,
		)
		await safe(await send([target.body]), `${target.path} array body`)
		const label = `${target.method} ${target.path} 3MB`
		expect(await safe(await send({ blob: 'x'.repeat(3_000_000) }), label), label).toBe(413)
	}
	expect(requests).toBeGreaterThan(1000)
})

test('money fields reject negative, fractional, huge and non-numeric amounts', async ({
	playwright,
}) => {
	const seller = await makeSeller(playwright)
	const typeId = dbQuery<string>(
		`return (await db.select({ id: schema.productTypes.id }).from(schema.productTypes).where(eq(schema.productTypes.kind, 'physical')))[0].id`,
	)
	const create = (money: Record<string, unknown>) =>
		seller.api.post('/api/v1/shop/products', {
			data: {
				productTypeId: typeId,
				title: 'money fuzz',
				slug: `money-${unique()}`,
				description: 'money fuzzing product',
				priceCents: 100,
				...money,
			},
		})
	for (const priceCents of [
		-1,
		0,
		0.5,
		99.99,
		100_000_001,
		1e20,
		'100abc',
		'1e999',
		'Infinity',
		null,
	]) {
		expect(
			await safe(await create({ priceCents }), `priceCents ${priceCents}`),
			`priceCents ${priceCents}`,
		).toBe(400)
	}
	for (const shippingCents of [-1, 0.1, 1e12])
		expect((await create({ shippingCents })).status()).toBe(400)
	for (const stock of [-1, 2.5, 1e9]) expect((await create({ stock })).status()).toBe(400)
	// z.coerce turns `true` into 1 and `[100]` into 100: odd, but still whole, in-range cents.
	for (const priceCents of [true, [100], ' 100 ']) {
		await safe(await create({ priceCents }), `priceCents ${priceCents}`)
	}
	// The limits themselves are accepted.
	await ok(await create({ priceCents: 100_000_000, shippingCents: 0, stock: 0 }))
})

test('enums and mass assignment: unknown values are rejected, privileged fields ignored', async ({
	playwright,
}) => {
	const api = await newApi(playwright)
	const email = `role-${unique()}@qa.resell.test`
	const signup = await ok<{ user: { role: string } }>(
		await api.post('/api/auth/signup', {
			data: { name: 'sneaky user', email, password: 'Ab1!Ab1!', role: 'admin', id: 'x' },
		}),
	)
	expect(signup.user.role).toBe('user')
	await ok(
		await api.patch('/api/profile', {
			data: {
				name: 'sneaky user',
				role: 'admin',
				email: 'admin@load.resell.sh',
				passwordHash: 'x',
			},
		}),
	)
	expect(
		(await ok<{ user: { role: string; email: string } }>(await api.get('/api/profile'))).user,
	).toMatchObject({
		role: 'user',
		email,
	})
	expect((await api.get('/api/admin/stats')).status()).toBe(403)

	const seller = await makeSeller(playwright)
	for (const data of [
		{ name: 'x', scopes: ['admin'] },
		{ name: 'x', scopes: ['shop:read', 'shop:*'] },
		{ name: 'x', scopes: [] },
		{ name: 'x', scopes: ['shop:read'], expiresInDays: 7 },
		{ name: 'x', scopes: ['shop:read'], expiresInDays: -30 },
	]) {
		expect(
			(await seller.api.post('/api/v1/shop/tokens', { data })).status(),
			JSON.stringify(data),
		).toBe(400)
	}
	expect((await seller.api.put('/api/v1/shop/branding/favicon')).status()).toBe(400)
	for (const query of [
		'sort=drop',
		'kind=weapon',
		'perPage=49',
		'perPage=0',
		'page=0',
		'page=-1',
		'minPrice=10&maxPrice=1',
		`q=${'x'.repeat(101)}`,
	]) {
		expect(await safe(await api.get(`/api/products?${query}`), query), query).toBe(400)
	}
	const admin = await newApi(playwright)
	await logIn(admin, LOAD_ADMIN_EMAIL)
	for (const status of ['deleted', 'ADMIN', '', null]) {
		expect(
			(
				await admin.patch(`/api/admin/shops/${seller.shopId}`, {
					data: { status, reason: 'x' },
				})
			).status(),
		).toBe(400)
	}
})

test('SQL injection strings are plain data in search, filters, ids and login', async ({
	playwright,
}) => {
	const api = await newApi(playwright)
	const total = async (query: string): Promise<number> =>
		(await ok<{ meta: { total: number } }>(await api.get(`/api/products?${query}`))).meta.total
	const all = await total('perPage=1')
	expect(all).toBeGreaterThan(1000)
	// LIKE wildcards are only a (harmless) broad search, never a 5xx.
	for (const value of ['%', '_', '%%']) await total(`q=${encodeURIComponent(value)}`)
	for (const value of [...SQLI, "%' OR 1=1 --"]) {
		const q = encodeURIComponent(value)
		expect(await total(`q=${q}`), value).toBeLessThan(all)
		for (const filter of ['type', 'shop']) {
			expect(await total(`${filter}=${q}`), `${filter}=${value}`).toBe(0)
		}
		expect(await safe(await api.get(`/api/products/${q}`), `product ${value}`)).toBe(404)
		expect(await safe(await api.get(`/api/shops/${q}`), `shop ${value}`)).toBe(404)
		const login = await api.post('/api/auth/login', {
			data: { email: `${LOAD_ADMIN_EMAIL}${value}`, password: value },
			headers: { 'x-real-ip': ip() },
		})
		expect([400, 401], value).toContain(await safe(login, `login ${value}`))
	}
	expect(await safe(await api.get('/api/products?page=999999999999'), 'huge page')).toBe(200)
})

async function noScriptRan(page: Page): Promise<void> {
	expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()
}

test('stored XSS: hostile shop, product, profile, address and review text renders as text', async ({
	page,
	playwright,
}) => {
	test.setTimeout(120_000)
	const dialogs: string[] = []
	page.on('dialog', (dialog) => {
		dialogs.push(dialog.message())
		void dialog.dismiss()
	})
	const seller = await makeSeller(playwright)
	await ok(await seller.api.patch('/api/v1/shop', { data: { name: SVG, description: SCRIPT } }))
	const product = await listProduct(seller, 'physical', {
		title: `${XSS} lamp`,
		description: `${SCRIPT} ${XSS} a hostile description`,
	})
	const buyer = await makeBuyer(playwright)
	await ok(await buyer.api.patch('/api/profile', { data: { name: SVG } }))
	await ok(
		await buyer.api.patch(`/api/profile/addresses/${buyer.addressId}`, {
			data: {
				fullName: XSS,
				line1: SCRIPT,
				city: 'x',
				state: 'OR',
				postalCode: '97201',
				country: 'US',
				phone: SVG.slice(0, 30),
			},
		}),
	)
	const orderId = await checkout(buyer, [[product.id]])
	await pay(buyer.api, orderId)
	const orderItemId = dbQuery<string>(`
    const [row] = await db.select({ id: schema.orderItems.id }).from(schema.orderItems)
      .innerJoin(schema.sellerOrders, eq(schema.orderItems.sellerOrderId, schema.sellerOrders.id))
      .where(eq(schema.sellerOrders.orderId, ${JSON.stringify(orderId)}))
    return row.id
  `)
	await ok(
		await buyer.api.post('/api/reviews', {
			data: { orderItemId, rating: 3, comment: `${XSS} ${SCRIPT}` },
		}),
	)

	// What a visitor, the buyer and the seller see.
	await open(page, `/products/${product.slug}`)
	await expect(page.getByRole('heading', { level: 1 })).toContainText(XSS)
	await expect(page.getByText(`${XSS} ${SCRIPT}`).first()).toBeVisible()
	await noScriptRan(page)
	await open(page, `/shops/${seller.shopSlug}`)
	await expect(page.getByText(SVG).first()).toBeVisible()
	await noScriptRan(page)
	await open(page, `/marketplace?q=${encodeURIComponent('onerror')}`)
	await expect(page.getByText(`${XSS} lamp`).first()).toBeVisible()
	await noScriptRan(page)

	await logInPage(page, buyer.email)
	await open(page, `/orders/${orderId}`)
	await noScriptRan(page)
	await open(page, '/profile')
	await noScriptRan(page)

	await page.context().clearCookies()
	await logInPage(page, seller.email)
	await open(page, '/my-shop/orders')
	await expect(page.getByText(XSS).first()).toBeVisible()
	await noScriptRan(page)
	expect(dialogs).toEqual([])
})

async function logInPage(page: Page, email: string): Promise<void> {
	await ok(await page.request.post('/api/auth/login', { data: { email, password: 'Ab1!Ab1!' } }))
}

test('reflected XSS: hostile query strings and paths render as text', async ({ page }) => {
	const dialogs: string[] = []
	page.on('dialog', (dialog) => {
		dialogs.push(dialog.message())
		void dialog.dismiss()
	})
	const hostile = encodeURIComponent(XSS)
	await open(page, `/marketplace?q=${hostile}`)
	await expect(page.getByRole('heading', { level: 1 })).toContainText(XSS)
	await noScriptRan(page)
	for (const path of [
		`/marketplace?type=${hostile}&shop=${hostile}&sort=${hostile}`,
		`/products/${hostile}`,
		`/shops/${hostile}`,
		`/reset-password?token=${hostile}`,
		`/checkout/success?order=${hostile}`,
		`/login?redirect=${encodeURIComponent('javascript:alert(1)')}`,
		`/contact?name=${hostile}`,
	]) {
		const response = await page.goto(path)
		expect(response?.status(), path).toBeLessThan(500)
		expect(await response?.text(), path).not.toContain(XSS)
		await noScriptRan(page)
	}
	expect(dialogs).toEqual([])
})

test('UI forms: hostile and exotic input shows validation, never breaks the page', async ({
	page,
}) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	page.on('dialog', (dialog) => {
		errors.push(`dialog: ${dialog.message()}`)
		void dialog.dismiss()
	})

	// Signup: invalid values are caught client-side, then a unicode name signs up and shows as text.
	await open(page, '/signup')
	await page.locator('input[name=name]').fill(SVG.repeat(3))
	await page.locator('input[name=email]').fill("' OR 1=1 --")
	await page.locator('input[name=password]').fill('short')
	await page.getByRole('button', { name: 'Create account' }).click()
	await expect(page).toHaveURL(/\/signup/)
	await expect(page.getByText(/at most 24|valid email|invalid email/i).first()).toBeVisible()
	const name = 'émoji 😀 日本語'
	await page.locator('input[name=name]').fill(name)
	await page.locator('input[name=email]').fill(`ui-fuzz-${unique()}@qa.resell.test`)
	await page.locator('input[name=password]').fill('Ab1!Ab1!')
	// Leave the field first, as a person does: a submit within Nuxt UI's 300 ms input-validation debounce
	// after a failed submit is silently dropped (reported in docs/testing.md, a UForm race).
	await page.keyboard.press('Tab')
	await expect(page.getByText(/at most 24|invalid email/i)).toHaveCount(0)
	const signedUp = page.waitForResponse('**/api/auth/signup')
	await page.getByRole('button', { name: 'Create account' }).click()
	expect((await signedUp).status()).toBe(200)
	await expect(page).not.toHaveURL(/\/signup/)
	expect(
		(await ok<{ user: { name: string } }>(await page.request.get('/api/profile'))).user.name,
	).toBe(name)

	// Contact: markup and emoji go through as plain text.
	await open(page, '/contact')
	const form = page.locator('form', { has: page.getByRole('button', { name: 'Send message' }) })
	await form.locator('[name=name]').fill(`${XSS} 😀`)
	await form.locator('[name=email]').fill('visitor@qa.resell.test')
	await form.locator('[name=subject]').fill(SCRIPT)
	await form.locator('[name=message]').fill(`${XSS} ${'ü'.repeat(500)}`)
	await form.getByRole('button', { name: 'Send message' }).click()
	await expect(page.getByText('Message sent').first()).toBeVisible()
	await noScriptRan(page)
	expect(errors).toEqual([])
})
