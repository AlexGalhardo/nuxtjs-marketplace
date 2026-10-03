import { randomInt } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { test as base, expect } from '@nuxt/test-utils/playwright'
import type { APIRequestContext, APIResponse, Page, Playwright } from '@playwright/test'
import Stripe from 'stripe'
import { LOAD_PASSWORD } from '../../server/db/seed-load'
import type { ProductType } from '../../shared/types/db'
import { dbQuery } from '../integration/helpers/db'
import { FAKE_STRIPE_PORT, type RecordedRequest } from '../integration/helpers/fake-stripe'

// Shared fixtures for the QA / pentest suite (docs/testing.md "QA & pentest suite").

export { dbQuery, expect, LOAD_PASSWORD }
export const PASSWORD = 'Ab1!Ab1!'
export const WEBHOOK_SECRET = 'whsec_test_integration'
// playwright.config.ts webServer env: the server appends every logged mail here.
export const OUTBOX_FILE = '.data-test/mail-outbox.jsonl'
export const CONTACT_EMAIL = 'contact@qa.resell.test'

export const unique = (): string => `${Date.now().toString(36)}${randomInt(36 ** 5).toString(36)}`
// The app rate-limits per `X-Real-IP` (nuxt.config.ts); one address per client, like real traffic.
export const ip = (): string => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`

// Every test's browser context and `request` get their own client IP.
export const test = base.extend({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependencies from this destructuring.
	extraHTTPHeaders: async ({}, use) => {
		await use({ 'x-real-ip': ip() })
	},
})

const baseURL = (): string => test.info().project.use.baseURL ?? 'http://localhost:3100'

export function newApi(
	playwright: Playwright,
	headers: Record<string, string> = {},
): Promise<APIRequestContext> {
	return playwright.request.newContext({
		baseURL: baseURL(),
		extraHTTPHeaders: { 'x-real-ip': ip(), ...headers },
	})
}

// `page.goto` + wait until Nuxt finished hydrating (what @nuxt/test-utils' `goto` does).
export async function open(page: Page, path: string): Promise<APIResponse | null> {
	const response = await page.goto(path)
	await page.waitForFunction(
		() =>
			(window as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.()
				.isHydrating === false,
	)
	return response
}

export async function ok<T = Record<string, unknown>>(response: APIResponse): Promise<T> {
	expect(response.status(), `${response.url()}: ${await response.text()}`).toBeLessThan(400)
	const text = await response.text()
	return (text ? JSON.parse(text) : null) as T
}

export async function signUp(
	api: APIRequestContext,
	label = 'qa',
): Promise<{ id: string; email: string }> {
	const email = `${label}-${unique()}@qa.resell.test`
	const body = await ok<{ user: { id: string } }>(
		await api.post('/api/auth/signup', {
			data: { name: `${label} tester`.slice(0, 24), email, password: PASSWORD },
		}),
	)
	return { id: body.user.id, email }
}

export async function logIn(
	api: APIRequestContext,
	email: string,
	password = LOAD_PASSWORD,
): Promise<void> {
	await ok(await api.post('/api/auth/login', { data: { email, password } }))
}

export interface Seller {
	api: APIRequestContext
	id: string
	email: string
	shopId: string
	shopSlug: string
}

// A fresh seller with an onboarded shop (what the `account.updated` webhook sets after Stripe onboarding).
export async function makeSeller(
	playwright: Playwright,
	stripeAccountId = 'acct_qa',
): Promise<Seller> {
	const api = await newApi(playwright)
	const user = await signUp(api, 'seller')
	const shopSlug = `qa-shop-${unique()}`
	const shop = await ok<{ id: string }>(
		await api.post('/api/v1/shop', {
			data: { name: `qa shop ${shopSlug.slice(-6)}`, slug: shopSlug },
		}),
	)
	dbQuery(`
    await db.update(schema.shops).set({ chargesEnabled: true, payoutsEnabled: true, stripeAccountId: ${JSON.stringify(stripeAccountId)} }).where(eq(schema.shops.id, ${JSON.stringify(shop.id)}))
  `)
	return { api, ...user, shopId: shop.id, shopSlug }
}

let types: ProductType[] | undefined
export async function productTypes(api: APIRequestContext): Promise<ProductType[]> {
	types ??= await ok<ProductType[]>(await api.get('/api/product-types'))
	return types
}

export async function listProduct(
	seller: Seller,
	kind: 'physical' | 'digital',
	extra: {
		title?: string
		priceCents?: number
		shippingCents?: number
		stock?: number
		description?: string
	} = {},
): Promise<{ id: string; slug: string }> {
	const type = (await productTypes(seller.api)).find((entry) => entry.kind === kind)
	const slug = `qa-${kind}-${unique()}`
	const product = await ok<{ id: string }>(
		await seller.api.post('/api/v1/shop/products', {
			data: {
				productTypeId: type?.id,
				title: `qa ${kind} ${slug.slice(-5)}`,
				slug,
				description: 'qa suite product, safe to ignore.',
				priceCents: 2500,
				...(kind === 'physical' ? { shippingCents: 500, stock: 5 } : {}),
				...extra,
			},
		}),
	)
	await ok(await seller.api.post(`/api/v1/shop/products/${product.id}/publish`))
	return { id: product.id, slug }
}

export interface Buyer {
	api: APIRequestContext
	id: string
	email: string
	addressId: string
}

export async function makeBuyer(playwright: Playwright): Promise<Buyer> {
	const api = await newApi(playwright)
	const user = await signUp(api, 'buyer')
	const address = await ok<{ id: string }>(
		await api.post('/api/profile/addresses', {
			data: {
				fullName: 'qa buyer',
				line1: '1 test street',
				city: 'portland',
				state: 'OR',
				postalCode: '97201',
				country: 'US',
				phone: '555-0100',
				isDefault: true,
			},
		}),
	)
	return { api, ...user, addressId: address.id }
}

// Adds the lines to the cart and starts checkout: a pending order with a (fake) Stripe session.
export async function checkout(
	buyer: Buyer,
	lines: [productId: string, quantity?: number][],
): Promise<string> {
	for (const [productId, quantity = 1] of lines) {
		await ok(await buyer.api.post('/api/cart/items', { data: { productId, quantity } }))
	}
	const body = await ok<{ orderId: string }>(
		await buyer.api.post('/api/checkout', { data: { addressId: buyer.addressId } }),
	)
	return body.orderId
}

export async function signedWebhook(
	api: APIRequestContext,
	event: { id: string; type: string; data: { object: unknown } },
	{ secret = WEBHOOK_SECRET, timestamp }: { secret?: string; timestamp?: number } = {},
): Promise<APIResponse> {
	const payload = JSON.stringify({ object: 'event', api_version: '2026-01-01', ...event })
	const signature = await new Stripe('sk_test_fake').webhooks.generateTestHeaderStringAsync({
		payload,
		secret,
		timestamp,
	})
	return api.post('/api/stripe/webhook', {
		data: payload,
		headers: { 'content-type': 'application/json', 'stripe-signature': signature },
	})
}

export function paidSessionEvent(
	orderId: string,
	amountTotal: number,
	paymentIntent = `pi_qa_${unique()}`,
) {
	return {
		id: `evt_qa_${unique()}`,
		type: 'checkout.session.completed',
		data: {
			object: {
				id: `cs_qa_${unique()}`,
				object: 'checkout.session',
				payment_status: 'paid',
				payment_intent: paymentIntent,
				amount_total: amountTotal,
				metadata: { orderId },
			},
		},
	}
}

export function orderTotal(orderId: string): number {
	return dbQuery<number>(`
    const [order] = await db.select({ total: schema.orders.totalCents }).from(schema.orders).where(eq(schema.orders.id, ${JSON.stringify(orderId)}))
    return order?.total
  `)
}

// What Stripe sends once the card is charged.
export async function pay(
	api: APIRequestContext,
	orderId: string,
	paymentIntent?: string,
): Promise<void> {
	await ok(
		await signedWebhook(api, paidSessionEvent(orderId, orderTotal(orderId), paymentIntent)),
	)
}

export function sellerOrderOf(orderId: string, shopId: string): string {
	return dbQuery<string>(`
    const [row] = await db.select({ id: schema.sellerOrders.id }).from(schema.sellerOrders).where(and(eq(schema.sellerOrders.orderId, ${JSON.stringify(orderId)}), eq(schema.sellerOrders.shopId, ${JSON.stringify(shopId)})))
    return row?.id
  `)
}

export interface Mail {
	to: string
	subject: string
	text: string
}

export function outbox(to: string): Mail[] {
	if (!existsSync(OUTBOX_FILE)) return []
	return readFileSync(OUTBOX_FILE, 'utf-8')
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as Mail)
		.filter((mail) => mail.to === to)
}

export async function stripeRequests(
	api: APIRequestContext,
	path: string,
): Promise<RecordedRequest[]> {
	const all = (await (
		await api.get(`http://127.0.0.1:${FAKE_STRIPE_PORT}/__requests`)
	).json()) as RecordedRequest[]
	return all.filter((request) => request.path === path)
}

// A 4xx/5xx body must never leak internals (OWASP A10): no stack, SQL, driver or Stripe details.
export const LEAK =
	/\bat .+:\d+:\d+|SQLITE|syntax error|drizzle|postgres|libsql|select .+ from|sk_test|whsec_/i
