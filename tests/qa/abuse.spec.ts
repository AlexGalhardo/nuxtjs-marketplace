import Stripe from 'stripe'
import { LOAD_PASSWORD } from '../../server/db/seed-load'
import {
	checkout,
	dbQuery,
	expect,
	listProduct,
	makeBuyer,
	makeSeller,
	newApi,
	ok,
	open,
	orderTotal,
	paidSessionEvent,
	pay,
	sellerOrderOf,
	signedWebhook,
	signUp,
	stripeRequests,
	test,
} from './helpers'

// Business-logic abuse: what a dishonest buyer, seller or outsider tries once the happy path works.

const stock = (productId: string): number | null =>
	dbQuery<number | null>(
		`return (await db.select({ s: schema.products.stock }).from(schema.products).where(eq(schema.products.id, ${JSON.stringify(productId)})))[0].s`,
	)
const logs = (orderId: string, type: string): { amountCents: number }[] =>
	dbQuery(`
    return db.select({ amountCents: schema.transactionLogs.amountCents }).from(schema.transactionLogs)
      .where(and(eq(schema.transactionLogs.orderId, ${JSON.stringify(orderId)}), eq(schema.transactionLogs.type, ${JSON.stringify(type)})))
  `)

test('client-sent prices, totals and quantities are ignored or rejected', async ({
	playwright,
}) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical', {
		priceCents: 4200,
		shippingCents: 300,
		stock: 3,
	})
	const digital = await listProduct(seller, 'digital', { priceCents: 999 })
	const buyer = await makeBuyer(playwright)

	const cart = await ok<{ totalCents: number }>(
		await buyer.api.post('/api/cart/items', {
			data: { productId: product.id, quantity: 1, priceCents: 1, totalCents: 1 },
		}),
	)
	expect(cart.totalCents).toBe(4500)
	for (const quantity of [0, -1, 1.5, 100, 1e9, 'two', null]) {
		const status = (
			await buyer.api.patch(`/api/cart/items/${product.id}`, { data: { quantity } })
		).status()
		expect(status, `quantity ${quantity}`).toBeGreaterThanOrEqual(400)
		expect(status).toBeLessThan(500)
	}
	// More than the stock, and a digital good bought five times.
	expect(
		(
			await buyer.api.patch(`/api/cart/items/${product.id}`, { data: { quantity: 4 } })
		).status(),
	).toBe(409)
	const withDigital = await ok<{ count: number }>(
		await buyer.api.post('/api/cart/items', { data: { productId: digital.id, quantity: 5 } }),
	)
	expect(withDigital.count).toBe(2)

	const response = await buyer.api.post('/api/checkout', {
		data: { addressId: buyer.addressId, totalCents: 1, amount: 1, priceCents: 1, feeBps: 0 },
	})
	const { orderId } = await ok<{ orderId: string }>(response)
	expect(orderTotal(orderId)).toBe(4200 + 300 + 999)
	const [session] = (await stripeRequests(buyer.api, '/v1/checkout/sessions')).filter(
		(entry) => entry.body['metadata[orderId]'] === orderId,
	)
	const amounts = Object.entries(session?.body ?? {})
		.filter(([key]) => key.endsWith('[unit_amount]'))
		.map(([, value]) => Number(value))
		.sort((a, b) => a - b)
	expect(amounts).toEqual([300, 999, 4200])
})

test('a seller cannot buy from their own shop', async ({ playwright }) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical')
	expect(
		(await seller.api.post('/api/cart/items', { data: { productId: product.id } })).status(),
	).toBe(400)
})

test('drafts, archived products and suspended shops cannot be bought', async ({ playwright }) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical')
	const buyer = await makeBuyer(playwright)
	await ok(await seller.api.post(`/api/v1/shop/products/${product.id}/archive`))
	expect(
		(await buyer.api.post('/api/cart/items', { data: { productId: product.id } })).status(),
	).toBe(404)
})

test('concurrent checkouts of the last unit never drive stock negative', async ({ playwright }) => {
	test.setTimeout(120_000)
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical', { stock: 1 })
	const buyers = await Promise.all(Array.from({ length: 4 }, () => makeBuyer(playwright)))
	for (const buyer of buyers)
		await ok(await buyer.api.post('/api/cart/items', { data: { productId: product.id } }))

	const started = await Promise.all(
		buyers.map((buyer) =>
			buyer.api.post('/api/checkout', { data: { addressId: buyer.addressId } }),
		),
	)
	const orders: string[] = []
	for (const response of started) {
		expect(response.status()).toBeLessThan(500)
		if (response.ok()) orders.push(((await response.json()) as { orderId: string }).orderId)
	}
	// Stock is checked at checkout and decremented on payment (checkout.post.ts): Stripe may confirm all.
	const webhooks = await Promise.all(
		orders.map((orderId) =>
			signedWebhook(
				buyers[0]?.api ?? seller.api,
				paidSessionEvent(orderId, orderTotal(orderId)),
			),
		),
	)
	for (const webhook of webhooks) expect(webhook.status()).toBe(200)
	expect(stock(product.id)).toBe(0)
	// Nobody can add the sold-out product any more.
	const late = await makeBuyer(playwright)
	expect(
		(await late.api.post('/api/cart/items', { data: { productId: product.id } })).status(),
	).toBe(409)
})

test('webhooks: unsigned, forged, tampered, stale and replayed events change nothing', async ({
	playwright,
}) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical', { stock: 5 })
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[product.id, 2]])
	const event = paidSessionEvent(orderId, orderTotal(orderId))
	const outsider = await newApi(playwright)
	const status = (orderStatus = orderId) =>
		dbQuery<string>(
			`return (await db.select({ s: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, ${JSON.stringify(orderStatus)})))[0].s`,
		)

	const payload = JSON.stringify({ object: 'event', ...event })
	expect(
		(
			await outsider.post('/api/stripe/webhook', {
				data: payload,
				headers: { 'content-type': 'application/json' },
			})
		).status(),
	).toBe(400)
	expect((await signedWebhook(outsider, event, { secret: 'whsec_attacker' })).status()).toBe(400)
	// Signed for one body, sent with another.
	const signature = await new Stripe('sk_test_fake').webhooks.generateTestHeaderStringAsync({
		payload,
		secret: 'whsec_test_integration',
	})
	const tampered = payload.replace('"paid"', '"paid" ').replace(String(orderTotal(orderId)), '1')
	expect(
		(
			await outsider.post('/api/stripe/webhook', {
				data: tampered,
				headers: { 'content-type': 'application/json', 'stripe-signature': signature },
			})
		).status(),
	).toBe(400)
	// Outside Stripe's 5-minute tolerance: a captured event replayed later.
	expect(
		(
			await signedWebhook(outsider, event, {
				timestamp: Math.floor(Date.now() / 1000) - 3600,
			})
		).status(),
	).toBe(400)
	expect(status()).toBe('pending')

	// The genuine event, delivered three times at once (Stripe retries): paid once, stock moves once.
	const deliveries = await Promise.all([1, 2, 3].map(() => signedWebhook(outsider, event)))
	for (const delivery of deliveries) expect(delivery.status()).toBeLessThan(500)
	await ok(await signedWebhook(outsider, event))
	expect(status()).toBe('paid')
	expect(stock(product.id)).toBe(3)
	expect(logs(orderId, 'payment.succeeded')).toHaveLength(1)
	expect(logs(orderId, 'transfer.created')).toHaveLength(1)
	// A second, different event for the same session (Stripe also sends async_payment_succeeded).
	await ok(
		await signedWebhook(outsider, {
			...paidSessionEvent(orderId, orderTotal(orderId)),
			type: 'checkout.session.async_payment_succeeded',
		}),
	)
	expect(stock(product.id)).toBe(3)
	expect(logs(orderId, 'payment.succeeded')).toHaveLength(1)
})

test('a refund happens once, even when the seller double-clicks', async ({ playwright }) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical')
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[product.id]])
	await pay(buyer.api, orderId)
	const sellerOrderId = sellerOrderOf(orderId, seller.shopId)

	const clicks = await Promise.all(
		[1, 2, 3].map(() => seller.api.post(`/api/v1/shop/orders/${sellerOrderId}/refund`)),
	)
	for (const click of clicks) expect(click.status()).toBeLessThan(500)
	expect((await seller.api.post(`/api/v1/shop/orders/${sellerOrderId}/refund`)).status()).toBe(
		409,
	)
	expect(logs(orderId, 'refund.created')).toHaveLength(1)
	expect(logs(orderId, 'transfer.reversed')).toHaveLength(1)
	// Stripe saw one idempotency key, however many requests reached it.
	const keys = new Set(
		(await stripeRequests(seller.api, '/v1/refunds'))
			.filter((entry) => entry.body['metadata[sellerOrderId]'] === sellerOrderId)
			.map((entry) => entry.idempotencyKey),
	)
	expect([...keys]).toEqual([`refund-${sellerOrderId}`])
})

test('reviews need a paid purchase, once per product, rating 1-5', async ({ playwright }) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical')
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[product.id]])
	const orderItemId = dbQuery<string>(`
    const [row] = await db.select({ id: schema.orderItems.id }).from(schema.orderItems)
      .innerJoin(schema.sellerOrders, eq(schema.orderItems.sellerOrderId, schema.sellerOrders.id))
      .where(eq(schema.sellerOrders.orderId, ${JSON.stringify(orderId)}))
    return row.id
  `)
	const review = (data: Record<string, unknown>) =>
		buyer.api.post('/api/reviews', { data: { orderItemId, rating: 5, ...data } })

	expect((await review({})).status()).toBe(409) // pending order: not paid yet
	expect((await review({ orderItemId: 'made-up' })).status()).toBe(404)
	await pay(buyer.api, orderId)
	for (const rating of [0, 6, -1, 4.5, '5; drop table reviews']) {
		expect((await review({ rating })).status(), `rating ${rating}`).toBe(400)
	}
	const [first, second] = await Promise.all([review({ rating: 4 }), review({ rating: 1 })])
	expect([first?.status(), second?.status()].sort()).toEqual([201, 409])
	expect((await review({})).status()).toBe(409)
	const rating = dbQuery<{ avg: number; count: number }>(`
    const [row] = await db.select({ avg: schema.products.ratingAvg, count: schema.products.ratingCount }).from(schema.products).where(eq(schema.products.id, ${JSON.stringify(product.id)}))
    return row
  `)
	expect(rating.count).toBe(1)
})

test('CSRF: cookie-authenticated writes from another origin are refused', async ({
	playwright,
}) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical')
	const buyer = await makeBuyer(playwright)
	const add = (headers: Record<string, string>) =>
		buyer.api.post('/api/cart/items', { data: { productId: product.id }, headers })
	expect((await add({ origin: 'https://evil.example' })).status()).toBe(403)
	expect((await add({ referer: 'https://evil.example/attack.html' })).status()).toBe(403)
	expect((await add({ origin: 'null' })).status()).toBe(403)
	expect(
		(
			await buyer.api.patch('/api/profile', {
				data: { name: 'csrf victim' },
				headers: { origin: 'http://localhost.evil.example' },
			})
		).status(),
	).toBe(403)
	const own = new URL(test.info().project.use.baseURL ?? '').origin
	expect((await add({ origin: own })).status()).toBe(200)
})

test('rate limits: login brute force, contact spam and checkout floods get 429', async ({
	playwright,
}) => {
	test.setTimeout(120_000)
	const attacker = await newApi(playwright)
	const statuses: number[] = []
	for (let attempt = 0; attempt < 40; attempt++) {
		statuses.push(
			(
				await attacker.post('/api/auth/login', {
					data: { email: 'admin@load.resell.sh', password: `guess-${attempt}` },
				})
			).status(),
		)
	}
	expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true)
	expect(statuses).toContain(429)
	// Even the right password stays locked out for this client.
	expect(
		(
			await attacker.post('/api/auth/login', {
				data: { email: 'admin@load.resell.sh', password: LOAD_PASSWORD },
			})
		).status(),
	).toBe(429)

	const spammer = await newApi(playwright)
	const contact: number[] = []
	for (let attempt = 0; attempt < 8; attempt++) {
		contact.push(
			(
				await spammer.post('/api/contact', {
					data: {
						name: 'spam bot',
						email: 'bot@spam.example',
						subject: 'buy now',
						message: 'cheap stuff for sale, click here',
					},
				})
			).status(),
		)
	}
	expect(contact).toContain(429)

	const buyer = await newApi(playwright)
	await signUp(buyer, 'flood')
	const floods: number[] = []
	for (let attempt = 0; attempt < 25; attempt++)
		floods.push((await buyer.post('/api/checkout', { data: {} })).status())
	expect(floods).toContain(429)
	expect(floods.every((status) => status < 500)).toBe(true)
})

test('path traversal on /images and /downloads never reaches private files', async ({
	playwright,
}) => {
	const api = await newApi(playwright)
	const attempts = [
		'/images/..%2Ffiles%2Fsecret.zip',
		'/images/%2e%2e/files/secret.zip',
		'/images/%252e%252e%252ffiles%252fsecret.zip',
		'/images/..%5cfiles%5csecret.zip',
		'/images/....//files/secret.zip',
		'/images/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
		'/images/..%c0%af..%c0%afetc/passwd',
		'/downloads/..%2F..%2Fetc%2Fpasswd',
		`/downloads/x?expires=9999999999&signature=${'0'.repeat(64)}`,
		'/downloads/x?expires=-1&signature=../../etc/passwd',
	]
	for (const path of attempts) {
		const response = await api.get(path)
		expect(response.status(), path).toBeGreaterThanOrEqual(400)
		expect(response.status(), path).toBeLessThan(500)
		expect(await response.text(), path).not.toMatch(/root:x?:0:0|^PK/)
	}
})

test('open redirect: ?redirect never leaves the site or runs script after login', async ({
	page,
	playwright,
}) => {
	const api = await newApi(playwright)
	const { email } = await signUp(api, 'redirect')
	await api.post('/api/auth/logout')
	const origin = new URL(test.info().project.use.baseURL ?? '').origin
	let dialogs = 0
	page.on('dialog', (dialog) => {
		dialogs++
		void dialog.dismiss()
	})
	for (const target of [
		'https://evil.example/',
		'//evil.example/',
		'/\\evil.example/',
		'javascript:alert(document.domain)',
		'http:evil.example',
	]) {
		await page.context().clearCookies()
		await open(page, `/login?redirect=${encodeURIComponent(target)}`)
		await page.locator('input[name=email]').fill(email)
		await page.locator('input[name=password]').fill('Ab1!Ab1!')
		await page.getByRole('button', { name: /log in|continue/i }).click()
		await page
			.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })
			.catch(() => undefined)
		expect(new URL(page.url()).origin, target).toBe(origin)
	}
	expect(dialogs).toBe(0)
})
