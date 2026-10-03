import { readdirSync } from 'node:fs'
import type { Page } from '@playwright/test'
import {
	LOAD_ADMIN_EMAIL,
	LOAD_SIZES,
	loadBuyerEmail,
	loadSellerEmail,
} from '../../server/db/seed-load'
import { dbQuery, expect, logIn, ok, open, test } from './helpers'

// A human tester's first pass: every page of every role, at phone and desktop width, light and dark.
// Each load must log no console error (CSP violations included), get no 4xx/5xx from our own origin,
// render exactly one h1 and never scroll sideways. Then every link is followed and every button that
// doesn't destroy data is clicked. Routes come from app/pages, so a new page is crawled automatically
// (and fails until it gets a role below).

type Role = 'guest' | 'buyer' | 'seller' | 'admin'

const roleOf = (route: string): Role => {
	if (route.startsWith('/admin')) return 'admin'
	if (route.startsWith('/my-shop')) return 'seller'
	if (/^\/(cart|checkout|orders|profile)/.test(route)) return 'buyer'
	return 'guest'
}

// Seeded accounts reserved for the crawl (server/db/seed-load.ts): this buyer has a paid order.
const buyerEmail = loadBuyerEmail(LOAD_SIZES.cartBuyers + 1)
const sellerEmail = loadSellerEmail(1)
const accounts: Record<Exclude<Role, 'guest'>, string> = {
	buyer: buyerEmail,
	seller: sellerEmail,
	admin: LOAD_ADMIN_EMAIL,
}

const routes = (readdirSync('app/pages', { recursive: true }) as string[])
	.map((file) => file.replace(/\\/g, '/'))
	.filter((file) => file.endsWith('.vue'))
	.map((file) => `/${file.replace(/\.vue$/, '').replace(/(^|\/)index$/, '')}`)

interface Fixtures {
	productSlug: string
	cartProductId: string
	orderId: string
	sellerProductId: string
}

let fixtures: Fixtures | undefined
function seeded(): Fixtures {
	fixtures ??= dbQuery<Fixtures>(`
    const one = async (query) => (await query.limit(1))[0]
    const product = (await db.select({ id: schema.products.id, slug: schema.products.slug, stock: schema.products.stock }).from(schema.products)
      .innerJoin(schema.shops, eq(schema.products.shopId, schema.shops.id))
      .where(and(eq(schema.products.status, 'published'), inArray(schema.shops.slug, ['load-shop-2', 'load-shop-3', 'load-shop-4', 'load-shop-5']), eq(schema.products.kind, 'physical')))).find((row) => row.stock > 0)
    const [buyer] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, ${JSON.stringify(buyerEmail)}))
    const order = await one(db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.buyerId, buyer.id)))
    const shop = await one(db.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.slug, 'load-shop-1')))
    const own = await one(db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.shopId, shop.id)))
    return { productSlug: product.slug, cartProductId: product.id, orderId: order.id, sellerProductId: own.id }
  `)
	return fixtures
}

const concrete = (route: string, data: Fixtures): string =>
	route
		.replace('/products/[slug]', `/products/${data.productSlug}`)
		.replace('/shops/[slug]', '/shops/load-shop-1')
		.replace('/orders/[id]', `/orders/${data.orderId}`)
		.replace('/my-shop/products/[id]', `/my-shop/products/${data.sellerProductId}`)
		.replace(/^\/checkout\/success$/, `/checkout/success?order=${data.orderId}`)
		.replace(/^\/reset-password$/, '/reset-password?token=qa-crawl-token')

// Labels a tester must not click while crawling: they destroy, publish, pay or leave the site.
const UNSAFE =
	/delete|remove|archive|refund|log ?out|sign ?out|revoke|ship|deliver|publish|suspend|hide|reject|restore|save|send|create|submit|post|pay|checkout|buy|upload|reset|password|connect|stripe|export|download|clear|cancel order/i

async function watch(page: Page, problems: string[]): Promise<void> {
	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (event) =>
			console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`),
		)
	})
	const origin = new URL(test.info().project.use.baseURL ?? '').origin
	page.on('console', (message) => {
		if (message.type() === 'error') problems.push(`${page.url()} console: ${message.text()}`)
	})
	page.on('pageerror', (error) => problems.push(`${page.url()} pageerror: ${error.message}`))
	page.on('dialog', (dialog) => {
		problems.push(`${page.url()} dialog: ${dialog.message()}`)
		void dialog.dismiss()
	})
	page.on('response', (response) => {
		const url = new URL(response.url())
		if (url.origin === origin && response.status() >= 400) {
			problems.push(`${page.url()} -> ${response.status()} ${url.pathname}${url.search}`)
		}
	})
}

async function signIn(page: Page, role: Role): Promise<Fixtures> {
	const data = seeded()
	if (role === 'guest') return data
	await logIn(page.request, accounts[role])
	// So /checkout has something to show (it bounces an empty cart back to /cart).
	if (role === 'buyer') {
		await ok(
			await page.request.post('/api/cart/items', { data: { productId: data.cartProductId } }),
		)
	}
	return data
}

async function auditPage(
	page: Page,
	path: string,
	theme: 'light' | 'dark' | null,
	problems: string[],
): Promise<void> {
	const response = await open(page, path)
	// Some pages finish client-only (the Scalar API docs): judge them once the network settles.
	await page.waitForLoadState('networkidle')
	expect(response?.status(), `${path} status`).toBeLessThan(400)
	const h1 = await page.locator('h1').count()
	if (h1 !== 1) problems.push(`${path}: ${h1} h1 elements`)
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
	)
	if (overflow > 0)
		problems.push(
			`${path}: scrolls sideways by ${overflow}px at ${page.viewportSize()?.width}px`,
		)
	const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
	if (theme && dark !== (theme === 'dark')) problems.push(`${path}: expected the ${theme} theme`)
}

const roles: Role[] = ['guest', 'buyer', 'seller', 'admin']
const viewports = [
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'desktop', width: 1440, height: 900 },
]

test('every page under app/pages has a crawl role', () => {
	expect(routes.length).toBeGreaterThan(20)
	for (const route of routes) expect(roles).toContain(roleOf(route))
})

for (const role of roles) {
	for (const viewport of viewports) {
		for (const theme of ['light', 'dark'] as const) {
			test(`${role} pages render cleanly (${viewport.name}, ${theme})`, async ({ page }) => {
				test.setTimeout(180_000)
				const problems: string[] = []
				await page.setViewportSize(viewport)
				await page.addInitScript(
					(mode) => localStorage.setItem('nuxt-color-mode', mode),
					theme,
				)
				await watch(page, problems)
				const data = await signIn(page, role)
				for (const route of routes.filter((entry) => roleOf(entry) === role)) {
					await auditPage(page, concrete(route, data), theme, problems)
				}
				expect(problems).toEqual([])
			})
		}
	}

	test(`${role}: every link resolves and every safe button clicks without errors`, async ({
		page,
	}) => {
		test.setTimeout(300_000)
		const problems: string[] = []
		await page.setViewportSize(viewports[1] ?? { width: 1440, height: 900 })
		await watch(page, problems)
		// Copy buttons (API docs, tokens) need what a real browser grants on click.
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
		const data = await signIn(page, role)
		const origin = new URL(test.info().project.use.baseURL ?? '').origin
		const checked = new Set<string>()
		// One link per page shape (/products/*, /marketplace?type) is enough to crawl what the app links to.
		const shapes = new Set<string>()
		const queue = routes
			.filter((entry) => roleOf(entry) === role)
			.map((route) => concrete(route, data))
		for (let index = 0; index < queue.length && index < 60; index++) {
			const path = queue[index] as string
			await auditPage(page, path, null, problems)

			const links = await page.$$eval('a[href]', (anchors) =>
				anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
			)
			for (const href of links) {
				const url = new URL(href)
				if (
					url.origin !== origin ||
					url.pathname.startsWith('/api/') ||
					checked.has(url.pathname + url.search)
				)
					continue
				checked.add(url.pathname + url.search)
				const status = (await page.request.get(url.href)).status()
				if (status >= 400)
					problems.push(`${path} links to ${url.pathname}${url.search}: ${status}`)
				const shape = `${url.pathname.split('/').slice(0, 2).join('/')}?${[...url.searchParams.keys()].sort().join()}`
				if (!shapes.has(shape) && !url.pathname.startsWith('/downloads')) {
					shapes.add(shape)
					if (!queue.includes(url.pathname + url.search))
						queue.push(url.pathname + url.search)
				}
			}

			const buttons = page.getByRole('button')
			const count = await buttons.count()
			for (let at = 0; at < count; at++) {
				const button = buttons.nth(at)
				if (
					!(await button.isVisible().catch(() => false)) ||
					!(await button.isEnabled().catch(() => false))
				)
					continue
				const label = `${(await button.getAttribute('aria-label')) ?? ''} ${await button.innerText().catch(() => '')}`
				if (UNSAFE.test(label) || (await button.getAttribute('type')) === 'submit') continue
				// An overlay (menu, modal) can cover the next button: that is not a defect, skip it.
				await button.click({ timeout: 2_000 }).catch(() => undefined)
				await page.keyboard.press('Escape')
				if (new URL(page.url()).pathname !== new URL(path, origin).pathname)
					await open(page, path)
			}
		}
		expect(problems).toEqual([])
	})
}
