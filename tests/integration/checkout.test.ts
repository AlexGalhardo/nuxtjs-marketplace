import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Cart } from '../../shared/types/cart'
import type { ProductType } from '../../shared/types/db'
import { dbQuery } from './helpers/db'
import { FAKE_STRIPE_PORT, type RecordedRequest } from './helpers/fake-stripe'
import { postWebhook } from './helpers/webhook'

const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
const ids: Record<string, string> = {}
const cookies: Record<string, string> = {}

async function signUp(name: string) {
	const response = await fetch('/api/auth/signup', {
		method: 'POST',
		body: JSON.stringify({
			name: `${name} tester`,
			email: `${name}-${run}@example.com`,
			password: 'Ab1!Ab1!',
		}),
		headers: { 'content-type': 'application/json' },
	})
	if (!response.ok) throw new Error(`signup failed: ${response.status}`)
	return response.headers.get('set-cookie')?.split(';')[0] ?? ''
}

async function createListing(
	cookie: string,
	typeId: string,
	body: { title: string; priceCents: number; shippingCents?: number; stock?: number },
) {
	const product = await $fetch<{ id: string }>('/api/v1/shop/products', {
		method: 'POST',
		headers: { cookie },
		body: {
			productTypeId: typeId,
			slug: `${body.title.replace(/\s/g, '-')}-${run}`,
			description: 'Checkout integration test product.',
			...body,
		},
	})
	await $fetch(`/api/v1/shop/products/${product.id}/publish`, {
		method: 'POST',
		headers: { cookie },
	})
	return product.id
}

function cartApi(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
	return fetch(path, {
		method: init.method ?? 'GET',
		headers: { cookie: init.cookie ?? cookies.buyer ?? '', 'content-type': 'application/json' },
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	})
}

async function stripeRequests(path: string) {
	const all = (await (
		await globalThis.fetch(`http://127.0.0.1:${FAKE_STRIPE_PORT}/__requests`)
	).json()) as RecordedRequest[]
	return all.filter((request) => request.path === path)
}

beforeAll(async () => {
	cookies.alice = await signUp('alice')
	cookies.bob = await signUp('bob')
	cookies.buyer = await signUp('buyer')
	const alice = await $fetch<{ id: string }>('/api/v1/shop', {
		method: 'POST',
		headers: { cookie: cookies.alice },
		body: { name: 'Alice Goods', slug: `alice-${run}` },
	})
	const bob = await $fetch<{ id: string }>('/api/v1/shop', {
		method: 'POST',
		headers: { cookie: cookies.bob },
		body: { name: 'Bob Goods', slug: `bob-${run}` },
	})
	ids.aliceShop = alice.id
	ids.bobShop = bob.id
	// Bob's `acct_fail` makes the fake Stripe reject his transfer (transfer.failed path).
	dbQuery(`
		await db.update(schema.shops).set({ chargesEnabled: true, stripeAccountId: 'acct_alice' }).where(eq(schema.shops.id, '${alice.id}'))
		await db.update(schema.shops).set({ chargesEnabled: true, stripeAccountId: 'acct_fail' }).where(eq(schema.shops.id, '${bob.id}'))
	`)

	const types = await $fetch<ProductType[]>('/api/product-types')
	const physical = types.find((type) => type.kind === 'physical')?.id ?? ''
	const digital = types.find((type) => type.kind === 'digital')?.id ?? ''
	ids.jacket = await createListing(cookies.alice, physical, {
		title: 'jacket',
		priceCents: 2000,
		shippingCents: 500,
		stock: 2,
	})
	ids.preset = await createListing(cookies.alice, digital, { title: 'preset', priceCents: 1000 })
	ids.lamp = await createListing(cookies.bob, physical, {
		title: 'lamp',
		priceCents: 3000,
		stock: 1,
	})
	dbQuery(`
		await db.insert(schema.productFiles).values({ productId: '${ids.preset}', blobPath: 'files/test/preset.zip', filename: 'preset.zip', size: 10, contentType: 'application/zip' })
	`)

	const address = await $fetch<{ id: string }>('/api/profile/addresses', {
		method: 'POST',
		headers: { cookie: cookies.buyer },
		body: {
			fullName: 'Buyer Person',
			line1: '1 Main St',
			city: 'Springfield',
			state: 'IL',
			postalCode: '62701',
			country: 'US',
			phone: '555-0100',
		},
	})
	ids.address = address.id
})

describe('cart', () => {
	it('requires a session', async () => {
		expect((await cartApi('/api/cart', { cookie: '' })).status).toBe(401)
	})

	it('adds items, forces digital quantity to 1 and groups by shop', async () => {
		await cartApi('/api/cart/items', { method: 'POST', body: { productId: ids.jacket } })
		await cartApi('/api/cart/items', {
			method: 'POST',
			body: { productId: ids.preset, quantity: 3 },
		})
		const response = await cartApi('/api/cart/items', {
			method: 'POST',
			body: { productId: ids.lamp },
		})
		const cart = (await response.json()) as Cart

		expect(cart.groups.map((group) => group.shopName).sort()).toEqual([
			'Alice Goods',
			'Bob Goods',
		])
		expect(cart.count).toBe(3)
		// jacket 20 + preset 10 + lamp 30; shipping: jacket 5 (flat per line), lamp 0.
		expect(cart).toMatchObject({ subtotalCents: 6000, shippingCents: 500, totalCents: 6500 })
		expect(cart).toMatchObject({ hasPhysical: true, canCheckout: true })
	})

	it('rejects more than the stock, own products and hidden products', async () => {
		const tooMany = await cartApi('/api/cart/items', {
			method: 'POST',
			body: { productId: ids.lamp },
		})
		expect(tooMany.status).toBe(409)
		const own = await cartApi('/api/cart/items', {
			method: 'POST',
			body: { productId: ids.jacket },
			cookie: cookies.alice,
		})
		expect(own.status).toBe(400)
		const unknown = await cartApi('/api/cart/items', {
			method: 'POST',
			body: { productId: 'nope' },
		})
		expect(unknown.status).toBe(404)
	})

	it('updates and removes lines', async () => {
		const updated = (await (
			await cartApi(`/api/cart/items/${ids.jacket}`, {
				method: 'PATCH',
				body: { quantity: 2 },
			})
		).json()) as Cart
		expect(updated.count).toBe(4)
		expect(
			(
				await cartApi(`/api/cart/items/${ids.jacket}`, {
					method: 'PATCH',
					body: { quantity: 3 },
				})
			).status,
		).toBe(409)
		expect(
			(
				await cartApi(`/api/cart/items/${ids.preset}`, {
					method: 'PATCH',
					body: { quantity: 2 },
				})
			).status,
		).toBe(400)

		await cartApi(`/api/cart/items/${ids.jacket}`, { method: 'PATCH', body: { quantity: 1 } })
		await cartApi(`/api/cart/items/${ids.lamp}`, { method: 'DELETE' })
		const cart = (await (await cartApi('/api/cart')).json()) as Cart
		expect(cart.groups).toHaveLength(1)
		await cartApi('/api/cart/items', { method: 'POST', body: { productId: ids.lamp } })
	})
})

describe('checkout and webhook', () => {
	it('requires an address of your own when the cart has physical items', async () => {
		expect((await cartApi('/api/checkout', { method: 'POST', body: {} })).status).toBe(400)
		const bogus = await cartApi('/api/checkout', {
			method: 'POST',
			body: { addressId: 'nope' },
		})
		expect(bogus.status).toBe(404)
	})

	it('creates a pending order and a Stripe Checkout Session', async () => {
		const response = await cartApi('/api/checkout', {
			method: 'POST',
			body: { addressId: ids.address },
		})
		expect(response.status).toBe(200)
		const { orderId, url } = (await response.json()) as { orderId: string; url: string }
		ids.order = orderId
		expect(url).toMatch(/^https:\/\/checkout\.stripe\.test\//)

		const [session] = (await stripeRequests('/v1/checkout/sessions')).filter(
			(request) => request.body['metadata[orderId]'] === orderId,
		)
		expect(session?.body['payment_intent_data[transfer_group]']).toBe(orderId)
		expect(session?.idempotencyKey).toBe(`checkout-${orderId}`)

		const [order] = dbQuery<Record<string, unknown>[]>(`
			return db.select().from(schema.orders).where(eq(schema.orders.id, '${orderId}'))
		`)
		// 10% fee on items only: alice 3000 → 300, bob 3000 → 300.
		expect(order).toMatchObject({
			status: 'pending',
			subtotalCents: 6000,
			shippingCents: 500,
			feeCents: 600,
			totalCents: 6500,
		})
		expect(order?.shippingAddress).toMatchObject({ line1: '1 Main St', country: 'US' })
	})

	it('rejects unsigned webhooks', async () => {
		const event = {
			id: `evt_bad_${run}`,
			type: 'checkout.session.completed',
			data: { object: {} },
		}
		expect((await postWebhook(event, 'whsec_wrong')).status).toBe(400)
	})

	it('fulfils a paid session once: stock, downloads, cart, transfers and logs', async () => {
		const session = {
			id: `cs_paid_${run}`,
			object: 'checkout.session',
			payment_status: 'paid',
			payment_intent: `pi_${run}`,
			amount_total: 6500,
			metadata: { orderId: ids.order },
		}
		const event = {
			id: `evt_paid_${run}`,
			type: 'checkout.session.completed',
			data: { object: session },
		}
		expect((await postWebhook(event)).status).toBe(200)
		// Same session again under a new event id: must not fulfil (or transfer) twice.
		expect((await postWebhook({ ...event, id: `evt_paid_again_${run}` })).status).toBe(200)

		const state = dbQuery<{
			order: { status: string; stripePaymentIntentId: string }
			sellerOrders: {
				shopId: string
				status: string
				payoutCents: number
				stripeTransferId: string | null
			}[]
			stock: { id: string; stock: number | null }[]
			grants: number
			cart: number
			logs: { type: string; amountCents: number; status: string }[]
		}>(`
			const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, '${ids.order}'))
			const sellerOrders = await db.select().from(schema.sellerOrders).where(eq(schema.sellerOrders.orderId, '${ids.order}'))
			const stock = await db.select({ id: schema.products.id, stock: schema.products.stock }).from(schema.products).where(inArray(schema.products.id, ['${ids.jacket}', '${ids.lamp}']))
			const grants = await db.select().from(schema.downloadGrants).where(eq(schema.downloadGrants.buyerId, order.buyerId))
			const cart = await db.select().from(schema.cartItems).where(eq(schema.cartItems.userId, order.buyerId))
			const logs = await db.select().from(schema.transactionLogs).where(eq(schema.transactionLogs.orderId, '${ids.order}'))
			return { order, sellerOrders, stock, grants: grants.length, cart: cart.length, logs }
		`)

		expect(state.order).toMatchObject({ status: 'paid', stripePaymentIntentId: `pi_${run}` })
		expect(state.sellerOrders.every((sellerOrder) => sellerOrder.status === 'paid')).toBe(true)
		expect(Object.fromEntries(state.stock.map((row) => [row.id, row.stock]))).toEqual({
			[ids.jacket as string]: 1,
			[ids.lamp as string]: 0,
		})
		expect(state.grants).toBe(1)
		expect(state.cart).toBe(0)

		const alice = state.sellerOrders.find((sellerOrder) => sellerOrder.shopId === ids.aliceShop)
		// alice: items 3000 + shipping 500 − fee 300.
		expect(alice).toMatchObject({
			payoutCents: 3200,
			stripeTransferId: expect.stringMatching(/^tr_/),
		})
		const transfers = (await stripeRequests('/v1/transfers')).filter(
			(request) => request.body.transfer_group === ids.order,
		)
		expect(
			transfers.find((request) => request.body.destination === 'acct_alice')?.body,
		).toMatchObject({
			amount: '3200',
			source_transaction: `ch_for_pi_${run}`,
		})
		expect(
			transfers.filter((request) => request.body.destination === 'acct_alice'),
		).toHaveLength(1)

		expect(state.logs.map((log) => log.type).sort()).toEqual([
			'checkout.created',
			'payment.succeeded',
			'transfer.created',
			'transfer.failed',
		])
		expect(state.logs.find((log) => log.type === 'payment.succeeded')?.amountCents).toBe(6500)
	})

	it('expires an abandoned checkout', async () => {
		await cartApi('/api/cart/items', { method: 'POST', body: { productId: ids.preset } })
		const { orderId } = (await (
			await cartApi('/api/checkout', { method: 'POST', body: {} })
		).json()) as {
			orderId: string
		}
		const event = {
			id: `evt_expired_${run}`,
			type: 'checkout.session.expired',
			data: {
				object: { id: `cs_exp_${run}`, object: 'checkout.session', metadata: { orderId } },
			},
		}
		expect((await postWebhook(event)).status).toBe(200)
		const [order] = dbQuery<{ status: string }[]>(`
			return db.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, '${orderId}'))
		`)
		expect(order?.status).toBe('expired')
	})
})
