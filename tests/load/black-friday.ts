// "Black friday" load test (PLAN.md Phase 18): N virtual users browse the catalog, search, open products,
// fill carts, check out and pay (signed fake-Stripe webhook) against the built server and the load seed.
// Prints RPS, p50/p95/p99 and the error rate, writes them to LOAD_SUMMARY_FILE, and exits 1 past the
// thresholds. Plain Bun script, no k6. Run: `bun run build && bun run db:seed:load && bun run test:load`.
//
// Env: LOAD_VUS (40), LOAD_DURATION_S (60), LOAD_THINK_MS (1000), LOAD_P95_MS (1500), LOAD_MAX_ERROR_RATE (0.01),
// LOAD_BASE_URL (use a running server; default: start .output on LOAD_PORT=3102 with the fake Stripe),
// LOAD_SUMMARY_FILE (load-summary.json).
import { type ChildProcess, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import Stripe from 'stripe'
import { LOAD_PASSWORD, LOAD_SIZES, loadBuyerEmail } from '../../server/db/seed-load'
import { FAKE_STRIPE_PORT, startFakeStripe } from '../integration/helpers/fake-stripe'

const env = (name: string, fallback: number): number => Number(process.env[name] ?? fallback)
const VUS = env('LOAD_VUS', 40)
const DURATION_MS = env('LOAD_DURATION_S', 60) * 1000
const P95_MS = env('LOAD_P95_MS', 1500)
const MAX_ERROR_RATE = env('LOAD_MAX_ERROR_RATE', 0.01)
// Real shoppers pause between pages: a 0.5x-1.5x random think time around LOAD_THINK_MS.
const THINK_MS = env('LOAD_THINK_MS', 1000)
const think = (): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, THINK_MS * (0.5 + Math.random())))
const PORT = env('LOAD_PORT', 3102)
const BASE = process.env.LOAD_BASE_URL ?? `http://127.0.0.1:${PORT}`
const SUMMARY_FILE = process.env.LOAD_SUMMARY_FILE ?? 'load-summary.json'
const WEBHOOK_SECRET = 'whsec_test_integration'

interface Sample {
	name: string
	ms: number
	ok: boolean
	status: number
}
const samples: Sample[] = []

// `expected` lists the non-2xx answers that are correct behavior (e.g. 409 when a product sells out).
async function hit(
	name: string,
	path: string,
	init: RequestInit & { ip: string; cookie?: string; expected?: number[] } = { ip: '' },
): Promise<{ ok: boolean; text: string } | null> {
	const { ip, cookie, expected = [], ...rest } = init
	const headers = new Headers(rest.headers)
	headers.set('x-real-ip', ip)
	if (cookie) headers.set('cookie', cookie)
	if (rest.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
	const started = performance.now()
	try {
		const response = await fetch(`${BASE}${path}`, { ...rest, headers })
		const text = await response.text()
		const ok = response.ok || expected.includes(response.status)
		samples.push({ name, ms: performance.now() - started, ok, status: response.status })
		return { ok: response.ok, text }
	} catch {
		samples.push({ name, ms: performance.now() - started, ok: false, status: 0 })
		return null
	}
}

const json = <T>(response: { ok: boolean; text: string } | null): T | null =>
	response?.ok ? (JSON.parse(response.text) as T) : null
const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)] as T

interface Product {
	id: string
	slug: string
	kind: string
	stock: number | null
}

async function catalog(): Promise<Product[]> {
	const products: Product[] = []
	for (let page = 1; page <= 10; page++) {
		const response = await fetch(`${BASE}/api/products?perPage=48&page=${page}`, {
			headers: { 'x-real-ip': '10.255.255.1' },
		})
		products.push(...((await response.json()) as { data: Product[] }).data)
	}
	return products
}

async function virtualUser(index: number, products: Product[], deadline: number): Promise<void> {
	const ip = `10.${200 + Math.floor(index / 65_000)}.${Math.floor(index / 255) % 255}.${(index % 254) + 1}`
	// Buyers past the cart and order ranges start empty (server/db/seed-load.ts).
	const email = loadBuyerEmail(LOAD_SIZES.cartBuyers + LOAD_SIZES.orderBuyers + 1 + index)
	const login = await fetch(`${BASE}/api/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-real-ip': ip },
		body: JSON.stringify({ email, password: LOAD_PASSWORD }),
	})
	const cookie = login.headers.get('set-cookie')?.split(';')[0]
	if (!login.ok || !cookie) throw new Error(`login failed for ${email}: ${login.status}`)
	const [address] =
		json<{ id: string }[]>(
			await hit('GET /api/profile/addresses', '/api/profile/addresses', { ip, cookie }),
		) ?? []
	const words = ['shoes', 'chair', 'pack', 'course', 'lamp', 'shirt', 'template', 'book']

	while (Date.now() < deadline) {
		await hit('GET /', '/', { ip, cookie })
		await think()
		await hit('GET /api/products', `/api/products?page=${1 + Math.floor(Math.random() * 50)}`, {
			ip,
			cookie,
		})
		await think()
		await hit('GET /api/products?q', `/api/products?q=${pick(words)}`, { ip, cookie })
		await think()
		const product = pick(products)
		await hit('GET /products/:slug', `/products/${product.slug}`, { ip, cookie })
		await hit('GET /api/products/:slug', `/api/products/${product.slug}`, { ip, cookie })
		await think()
		if (Math.random() < 0.3) {
			await hit('POST /api/cart/items', '/api/cart/items', {
				ip,
				cookie,
				method: 'POST',
				body: JSON.stringify({ productId: product.id }),
				expected: [409],
			})
			await hit('GET /api/cart', '/api/cart', { ip, cookie })
		}
		if (Math.random() < 0.08 && address) {
			const started = await hit('POST /api/checkout', '/api/checkout', {
				ip,
				cookie,
				method: 'POST',
				body: JSON.stringify({ addressId: address.id }),
				// An empty cart, or one a sold-out product just invalidated.
				expected: [400, 409],
			})
			const order = json<{ orderId: string }>(started)
			if (order) await payOrder(order.orderId, ip)
		}
	}
}

const stripe = new Stripe('sk_test_fake')
async function payOrder(orderId: string, ip: string): Promise<void> {
	const payload = JSON.stringify({
		id: `evt_load_${orderId}`,
		object: 'event',
		api_version: '2026-01-01',
		type: 'checkout.session.completed',
		data: {
			object: {
				id: `cs_load_${orderId}`,
				object: 'checkout.session',
				payment_status: 'paid',
				payment_intent: `pi_load_${orderId}`,
				metadata: { orderId },
			},
		},
	})
	const signature = await stripe.webhooks.generateTestHeaderStringAsync({
		payload,
		secret: WEBHOOK_SECRET,
	})
	await hit('POST /api/stripe/webhook', '/api/stripe/webhook', {
		ip,
		method: 'POST',
		body: payload,
		headers: { 'stripe-signature': signature },
	})
}

function percentile(sorted: number[], p: number): number {
	return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
}

function summarize(durationMs: number) {
	const stats = (list: Sample[]) => {
		const sorted = list.map((sample) => sample.ms).sort((a, b) => a - b)
		return {
			requests: list.length,
			errors: list.filter((sample) => !sample.ok).length,
			p50: Math.round(percentile(sorted, 50)),
			p95: Math.round(percentile(sorted, 95)),
			p99: Math.round(percentile(sorted, 99)),
		}
	}
	const overall = stats(samples)
	const byEndpoint = Object.fromEntries(
		[...new Set(samples.map((sample) => sample.name))].map((name) => [
			name,
			stats(samples.filter((sample) => sample.name === name)),
		]),
	)
	const statuses: Record<string, number> = {}
	for (const sample of samples)
		if (!sample.ok) statuses[sample.status] = (statuses[sample.status] ?? 0) + 1
	return {
		vus: VUS,
		durationS: Math.round(durationMs / 100) / 10,
		rps: Math.round((overall.requests / durationMs) * 10_000) / 10,
		errorRate: overall.requests ? overall.errors / overall.requests : 1,
		...overall,
		failedStatuses: statuses,
		thresholds: { p95Ms: P95_MS, maxErrorRate: MAX_ERROR_RATE },
		byEndpoint,
	}
}

async function startServer(): Promise<{ server: ChildProcess; stop: () => void }> {
	const fakeStripe = startFakeStripe()
	const server = spawn('bun', ['.output/server/index.mjs'], {
		stdio: 'ignore',
		env: {
			...process.env,
			PORT: String(PORT),
			HOST: '127.0.0.1',
			NUXT_HUB_DIR: '.data-test',
			NUXT_STRICT_ENV: 'false',
			NUXT_PUBLIC_SITE_URL: BASE,
			NUXT_SESSION_PASSWORD: 'x'.repeat(32),
			NUXT_STRIPE_SECRET_KEY: 'sk_test_fake',
			NUXT_STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
			NUXT_STRIPE_API_BASE: `http://127.0.0.1:${FAKE_STRIPE_PORT}`,
		},
	})
	for (const deadline = Date.now() + 60_000; Date.now() < deadline; ) {
		if (server.exitCode !== null) throw new Error(`server exited with ${server.exitCode}`)
		const healthy = await fetch(`${BASE}/api/health`).then(
			(response) => response.ok,
			() => false,
		)
		if (healthy) {
			return {
				server,
				stop: () => {
					server.kill()
					fakeStripe.close()
				},
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 250))
	}
	throw new Error(`server at ${BASE} never became healthy`)
}

async function main(): Promise<void> {
	const own = process.env.LOAD_BASE_URL ? null : await startServer()
	try {
		const products = await catalog()
		if (products.length < 100)
			throw new Error('Catalog too small: run `bun run db:seed:load` first.')
		console.log(
			`black friday: ${VUS} virtual users for ${DURATION_MS / 1000}s against ${BASE} (${products.length} products)`,
		)
		const started = Date.now()
		const results = await Promise.allSettled(
			Array.from({ length: VUS }, (_, index) =>
				virtualUser(index, products, started + DURATION_MS),
			),
		)
		for (const result of results) if (result.status === 'rejected') console.error(result.reason)
		const summary = summarize(Date.now() - started)
		writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`)

		console.table(summary.byEndpoint)
		console.log(
			`${summary.requests} requests, ${summary.rps} rps, p50 ${summary.p50} ms, p95 ${summary.p95} ms, p99 ${summary.p99} ms, errors ${(summary.errorRate * 100).toFixed(2)}% ${JSON.stringify(summary.failedStatuses)}`,
		)
		const failures = [
			summary.p95 > P95_MS && `p95 ${summary.p95} ms > ${P95_MS} ms`,
			summary.errorRate > MAX_ERROR_RATE &&
				`error rate ${summary.errorRate} > ${MAX_ERROR_RATE}`,
			results.some((result) => result.status === 'rejected') && 'a virtual user crashed',
		].filter(Boolean)
		if (failures.length) {
			console.error(`FAIL: ${failures.join('; ')}`)
			process.exitCode = 1
		} else {
			console.log('PASS')
		}
	} finally {
		own?.stop()
	}
}

await main()
