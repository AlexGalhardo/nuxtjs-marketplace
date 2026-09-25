import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ProductType } from '../../shared/types/db'
import type { BuyerOrder, BuyerOrderSummary, ShopOrder } from '../../shared/types/order'
import { dbQuery } from './helpers/db'
import { FAKE_STRIPE_PORT, type RecordedRequest } from './helpers/fake-stripe'
import { postWebhook } from './helpers/webhook'

// Phase 9: buyer orders + signed downloads, seller ship/deliver/refund, verified-buyer reviews.
const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
const ids: Record<string, string> = {}
const cookies: Record<string, string> = {}

async function signUp(name: string) {
	const response = await fetch('/api/auth/signup', {
		method: 'POST',
		body: JSON.stringify({
			name: `${name} tester`,
			email: `${name}-orders-${run}@example.com`,
			password: 'Ab1!Ab1!',
		}),
		headers: { 'content-type': 'application/json' },
	})
	if (!response.ok) throw new Error(`signup failed: ${response.status}`)
	return response.headers.get('set-cookie')?.split(';')[0] ?? ''
}

function api(path: string, cookie: string, init: { method?: string; body?: unknown } = {}) {
	return fetch(path, {
		method: init.method ?? 'GET',
		headers: { cookie, 'content-type': 'application/json' },
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	})
}

async function stripeRequests(path: RegExp) {
	const all = (await (
		await globalThis.fetch(`http://127.0.0.1:${FAKE_STRIPE_PORT}/__requests`)
	).json()) as RecordedRequest[]
	return all.filter((request) => path.test(request.path))
}

function logsFor(orderId: string) {
	return dbQuery<{ type: string; amountCents: number; sellerOrderId: string | null }[]>(`
		return db.select().from(schema.transactionLogs).where(eq(schema.transactionLogs.orderId, '${orderId}'))
	`)
}

// Cart → checkout → signed `checkout.session.completed`, like a real paid order.
async function buy(productIds: string[], paymentIntent: string) {
	for (const productId of productIds) {
		await api('/api/cart/items', cookies.buyer ?? '', { method: 'POST', body: { productId } })
	}
	const { orderId } = (await (
		await api('/api/checkout', cookies.buyer ?? '', {
			method: 'POST',
			body: { addressId: ids.address },
		})
	).json()) as { orderId: string }
	const event = {
		id: `evt_${paymentIntent}`,
		type: 'checkout.session.completed',
		data: {
			object: {
				id: `cs_${paymentIntent}`,
				object: 'checkout.session',
				payment_status: 'paid',
				payment_intent: paymentIntent,
				metadata: { orderId },
			},
		},
	}
	expect((await postWebhook(event)).status).toBe(200)
	return orderId
}

beforeAll(async () => {
	cookies.seller = await signUp('seller')
	cookies.buyer = await signUp('buyer')
	cookies.stranger = await signUp('stranger')
	const shop = await $fetch<{ id: string }>('/api/v1/shop', {
		method: 'POST',
		headers: { cookie: cookies.seller },
		body: { name: 'Order Goods', slug: `order-goods-${run}` },
	})
	ids.shop = shop.id
	dbQuery(`
		await db.update(schema.shops).set({ chargesEnabled: true, stripeAccountId: 'acct_orders' }).where(eq(schema.shops.id, '${shop.id}'))
	`)

	const types = await $fetch<ProductType[]>('/api/product-types')
	const listing = async (kind: 'physical' | 'digital', title: string, extra: object) => {
		const product = await $fetch<{ id: string }>('/api/v1/shop/products', {
			method: 'POST',
			headers: { cookie: cookies.seller },
			body: {
				productTypeId: types.find((type) => type.kind === kind)?.id,
				title,
				slug: `${title}-${run}`,
				description: 'Orders integration test product.',
				...extra,
			},
		})
		return product.id
	}
	ids.boots = await listing('physical', 'boots', {
		priceCents: 4000,
		shippingCents: 600,
		stock: 5,
	})
	ids.ebook = await listing('digital', 'ebook', { priceCents: 1500 })
	const form = new FormData()
	form.append('files', new File(['the whole book'], 'ebook.pdf', { type: 'application/pdf' }))
	await $fetch(`/api/v1/shop/products/${ids.ebook}/files`, {
		method: 'POST',
		headers: { cookie: cookies.seller },
		body: form,
	})
	for (const id of [ids.boots, ids.ebook]) {
		await $fetch(`/api/v1/shop/products/${id}/publish`, {
			method: 'POST',
			headers: { cookie: cookies.seller },
		})
	}

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
	ids.order = await buy([ids.boots, ids.ebook], `pi_orders_${run}`)
})

describe('buyer orders', () => {
	it('lists only the buyer’s own orders', async () => {
		const mine = (await (
			await api('/api/orders', cookies.buyer ?? '')
		).json()) as BuyerOrderSummary[]
		expect(mine.map((order) => order.id)).toContain(ids.order)
		expect(mine.find((order) => order.id === ids.order)).toMatchObject({
			status: 'paid',
			itemCount: 2,
			totalCents: 6100,
		})
		const theirs = (await (
			await api('/api/orders', cookies.stranger ?? '')
		).json()) as BuyerOrderSummary[]
		expect(theirs).toEqual([])
		expect((await api('/api/orders', '')).status).toBe(401)
	})

	it('shows the order grouped by seller, with a signed download link', async () => {
		const order = (await (
			await api(`/api/orders/${ids.order}`, cookies.buyer ?? '')
		).json()) as BuyerOrder
		expect(order.sellers).toHaveLength(1)
		const ebook = order.sellers[0]?.items.find((item) => item.kind === 'digital')
		expect(ebook?.downloads).toHaveLength(1)
		expect(ebook?.downloads[0]).toMatchObject({ filename: 'ebook.pdf', downloadsLeft: 5 })
		expect(ebook?.downloads[0]?.url).toMatch(
			/^\/downloads\/[^?]+\?expires=\d+&signature=[0-9a-f]{64}$/,
		)
		expect(ebook?.canReview).toBe(true)
		ids.downloadUrl = ebook?.downloads[0]?.url ?? ''
		ids.ebookItem = ebook?.id ?? ''
		ids.bootsItem = order.sellers[0]?.items.find((item) => item.kind === 'physical')?.id ?? ''
	})

	it('hides other people’s orders behind a 404', async () => {
		expect((await api(`/api/orders/${ids.order}`, cookies.stranger ?? '')).status).toBe(404)
	})
})

describe('signed downloads', () => {
	it('streams the private file and counts the download', async () => {
		const response = await fetch(ids.downloadUrl ?? '')
		expect(response.status).toBe(200)
		expect(await response.text()).toBe('the whole book')
		expect(response.headers.get('content-disposition')).toContain('ebook.pdf')
		expect(response.headers.get('cache-control')).toContain('no-store')

		const order = (await (
			await api(`/api/orders/${ids.order}`, cookies.buyer ?? '')
		).json()) as BuyerOrder
		const grant = order.sellers[0]?.items.find((item) => item.id === ids.ebookItem)
			?.downloads[0]
		expect(grant?.downloadsLeft).toBe(4)
	})

	it('rejects tampered or expired links', async () => {
		const url = ids.downloadUrl ?? ''
		const tampered = url.replace(/signature=./, (match) =>
			match.endsWith('0') ? `${match.slice(0, -1)}1` : `${match.slice(0, -1)}0`,
		)
		expect((await fetch(tampered)).status).toBe(403)
		const stale = url.replace(/expires=\d+/, 'expires=1000')
		expect((await fetch(stale)).status).toBe(403)
		expect((await fetch(url.split('?')[0] ?? '')).status).toBe(403)
	})

	it('stops at the download limit', async () => {
		dbQuery(`
			await db.update(schema.downloadGrants).set({ downloadCount: 5 }).where(eq(schema.downloadGrants.buyerId, (await db.select().from(schema.orders).where(eq(schema.orders.id, '${ids.order}')))[0].buyerId))
		`)
		expect((await fetch(ids.downloadUrl ?? '')).status).toBe(410)
		dbQuery(`
			await db.update(schema.downloadGrants).set({ downloadCount: 1 }).where(eq(schema.downloadGrants.buyerId, (await db.select().from(schema.orders).where(eq(schema.orders.id, '${ids.order}')))[0].buyerId))
		`)
	})
})

describe('seller orders', () => {
	it('lists the shop’s paid orders with the shipping address', async () => {
		const orders = (await (
			await api('/api/v1/shop/orders', cookies.seller ?? '')
		).json()) as ShopOrder[]
		const sale = orders.find((order) => order.orderId === ids.order)
		// items 5500 + shipping 600 − 10% fee on items 550.
		expect(sale).toMatchObject({ status: 'paid', payoutCents: 5550, buyerName: 'buyer tester' })
		expect(sale?.shippingAddress).toMatchObject({ line1: '1 Main St' })
		ids.sellerOrder = sale?.id ?? ''
		const none = (await (
			await api('/api/v1/shop/orders', cookies.stranger ?? '')
		).json()) as ShopOrder[]
		expect(none).toEqual([])
	})

	it('only lets the owner ship, and validates tracking details', async () => {
		const path = `/api/v1/shop/orders/${ids.sellerOrder}/ship`
		const body = { carrier: 'usps', trackingCode: '9400 1000 0000' }
		expect((await api(path, cookies.stranger ?? '', { method: 'POST', body })).status).toBe(404)
		expect(
			(await api(path, cookies.seller ?? '', { method: 'POST', body: { carrier: '' } }))
				.status,
		).toBe(400)
		expect(
			(
				await api(`/api/v1/shop/orders/${ids.sellerOrder}/deliver`, cookies.seller ?? '', {
					method: 'POST',
				})
			).status,
		).toBe(409)
		expect((await api(path, cookies.seller ?? '', { method: 'POST', body })).status).toBe(200)

		const order = (await (
			await api(`/api/orders/${ids.order}`, cookies.buyer ?? '')
		).json()) as BuyerOrder
		expect(order.sellers[0]).toMatchObject({
			status: 'shipped',
			carrier: 'usps',
			trackingCode: '9400 1000 0000',
		})
	})

	it('marks a shipped order delivered', async () => {
		const response = await api(
			`/api/v1/shop/orders/${ids.sellerOrder}/deliver`,
			cookies.seller ?? '',
			{
				method: 'POST',
			},
		)
		expect(response.status).toBe(200)
		expect(((await response.json()) as { status: string }).status).toBe('delivered')
	})
})

describe('reviews', () => {
	it('lets a verified buyer review once and updates the product rating', async () => {
		const stranger = await api('/api/reviews', cookies.stranger ?? '', {
			method: 'POST',
			body: { orderItemId: ids.ebookItem, rating: 1 },
		})
		expect(stranger.status).toBe(404)
		const invalid = await api('/api/reviews', cookies.buyer ?? '', {
			method: 'POST',
			body: { orderItemId: ids.ebookItem, rating: 6 },
		})
		expect(invalid.status).toBe(400)

		const created = await api('/api/reviews', cookies.buyer ?? '', {
			method: 'POST',
			body: { orderItemId: ids.ebookItem, rating: 4, comment: 'solid read' },
		})
		expect(created.status).toBe(201)
		const again = await api('/api/reviews', cookies.buyer ?? '', {
			method: 'POST',
			body: { orderItemId: ids.ebookItem, rating: 5 },
		})
		expect(again.status).toBe(409)

		const product = await $fetch<{
			ratingAvg: number
			ratingCount: number
			reviews: { rating: number; comment: string; buyerName: string }[]
		}>(`/api/products/ebook-${run}`)
		expect(product).toMatchObject({ ratingAvg: 4, ratingCount: 1 })
		expect(product.reviews[0]).toEqual(
			expect.objectContaining({ rating: 4, comment: 'solid read', buyerName: 'buyer' }),
		)
		expect(product.reviews[0]).not.toHaveProperty('buyerId')
	})
})

describe('refunds', () => {
	it('refunds the seller order in full, reverses the transfer and revokes downloads', async () => {
		const path = `/api/v1/shop/orders/${ids.sellerOrder}/refund`
		expect((await api(path, cookies.stranger ?? '', { method: 'POST' })).status).toBe(404)
		expect((await api(path, cookies.seller ?? '', { method: 'POST' })).status).toBe(200)
		// A second click is a 409, never a second refund.
		expect((await api(path, cookies.seller ?? '', { method: 'POST' })).status).toBe(409)

		const [refund] = (await stripeRequests(/^\/v1\/refunds$/)).filter(
			(request) => request.body['metadata[sellerOrderId]'] === ids.sellerOrder,
		)
		expect(refund?.body).toMatchObject({ payment_intent: `pi_orders_${run}`, amount: '6100' })
		expect(refund?.idempotencyKey).toBe(`refund-${ids.sellerOrder}`)
		const [reversal] = (await stripeRequests(/\/reversals$/)).filter(
			(request) => request.body['metadata[sellerOrderId]'] === ids.sellerOrder,
		)
		expect(reversal?.body.amount).toBe('5550')

		const order = (await (
			await api(`/api/orders/${ids.order}`, cookies.buyer ?? '')
		).json()) as BuyerOrder
		expect(order.status).toBe('refunded')
		expect(order.sellers[0]?.status).toBe('refunded')
		const ebook = order.sellers[0]?.items.find((item) => item.id === ids.ebookItem)
		expect(ebook?.downloads[0]?.url).toBeNull()
		expect((await fetch(ids.downloadUrl ?? '')).status).toBe(410)
		// Refunded items can't be reviewed.
		expect(order.sellers[0]?.items.find((item) => item.id === ids.bootsItem)?.canReview).toBe(
			false,
		)

		const types = logsFor(ids.order ?? '').map((log) => log.type)
		expect(types).toContain('refund.created')
		expect(types).toContain('transfer.reversed')
		expect(types.filter((type) => type === 'refund.created')).toHaveLength(1)
	})

	it('leaves the order untouched when Stripe refuses the refund', async () => {
		const orderId = await buy([ids.boots ?? ''], `pi_refund_fail_${run}`)
		const orders = (await (
			await api('/api/v1/shop/orders', cookies.seller ?? '')
		).json()) as ShopOrder[]
		const sale = orders.find((order) => order.orderId === orderId)
		const response = await api(`/api/v1/shop/orders/${sale?.id}/refund`, cookies.seller ?? '', {
			method: 'POST',
		})
		expect(response.status).toBe(502)
		const order = (await (
			await api(`/api/orders/${orderId}`, cookies.buyer ?? '')
		).json()) as BuyerOrder
		expect(order.status).toBe('paid')
		expect(logsFor(orderId).map((log) => log.type)).toContain('refund.failed')
	})
})
