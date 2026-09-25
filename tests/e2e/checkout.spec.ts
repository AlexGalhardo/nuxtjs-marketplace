import { expect, test } from '@nuxt/test-utils/playwright'
import Stripe from 'stripe'
import type { ProductType } from '../../shared/types/db'
import { FAKE_STRIPE_PORT, type RecordedRequest } from '../integration/helpers/fake-stripe'
import { markShopChargesEnabled } from '../integration/helpers/shop'

test('buyer adds to cart, checks out on Stripe and lands on a paid order', async ({
	page,
	goto,
	request,
	playwright,
}) => {
	const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`

	// Seller in its own request context, so the page stays a guest until the buyer signs up.
	const seller = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
	await seller.post('/api/auth/signup', {
		data: { name: 'Checkout Seller', email: `seller-${run}@example.com`, password: 'Ab1!Ab1!' },
	})
	const shop = await (
		await seller.post('/api/v1/shop', {
			data: { name: `Checkout Shop ${run}`, slug: `co-${run}` },
		})
	).json()
	markShopChargesEnabled(shop.id)
	const types = (await (await seller.get('/api/product-types')).json()) as ProductType[]
	const typeId = (kind: string) => types.find((type) => type.kind === kind)?.id
	const slugs: string[] = []
	for (const [kind, title, priceCents, extra] of [
		['physical', `tee ${run}`, 2500, { shippingCents: 500, stock: 3 }],
		['digital', `preset ${run}`, 900, {}],
	] as const) {
		const slug = `${kind}-co-${run}`
		slugs.push(slug)
		const product = await (
			await seller.post('/api/v1/shop/products', {
				data: {
					productTypeId: typeId(kind),
					title,
					slug,
					description: 'Checkout e2e.',
					priceCents,
					...extra,
				},
			})
		).json()
		await seller.post(`/api/v1/shop/products/${product.id}/publish`)
	}
	await seller.dispose()

	// D2: a guest's add to cart goes through login.
	await goto(`/products/${slugs[0]}`, { waitUntil: 'hydration' })
	await page.getByRole('button', { name: 'add to cart' }).click()
	await expect(page).toHaveURL(new RegExp(`/login\\?redirect=.*${slugs[0]}`))

	await page.request.post('/api/auth/signup', {
		data: { name: 'Checkout Buyer', email: `buyer-${run}@example.com`, password: 'Ab1!Ab1!' },
	})
	await page.request.post('/api/profile/addresses', {
		data: {
			fullName: 'Checkout Buyer',
			line1: '42 Terminal Ave',
			city: 'Portland',
			state: 'OR',
			postalCode: '97201',
			country: 'US',
			phone: '555-0142',
			isDefault: true,
		},
	})

	for (const slug of slugs) {
		await goto(`/products/${slug}`, { waitUntil: 'hydration' })
		await page.getByRole('button', { name: 'add to cart' }).click()
		await expect(page.getByRole('link', { name: /in your cart/ })).toBeVisible()
	}
	await expect(page.getByRole('link', { name: 'cart, 2 items' })).toBeVisible()

	await page.getByRole('link', { name: /in your cart/ }).click()
	await expect(page).toHaveURL('/cart')
	const summary = page.getByRole('complementary', { name: 'order summary' })
	// tee 25 + preset 9, shipping 5.
	await expect(summary).toContainText('$34.00')
	await expect(summary).toContainText('$39.00')

	await summary.getByRole('link', { name: 'check out' }).click()
	await expect(page).toHaveURL('/checkout')
	await expect(page.getByRole('radio', { name: /checkout buyer/i })).toBeChecked()

	// The fake Stripe hands back a checkout.stripe.test URL; stand in for Stripe's hosted page.
	await page.route('https://checkout.stripe.test/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: '<h1>stripe checkout</h1>' }),
	)
	await page.getByRole('button', { name: 'pay with stripe' }).click()
	await expect(page).toHaveURL(/checkout\.stripe\.test/)

	const sessions = (await (
		await request.get(`http://127.0.0.1:${FAKE_STRIPE_PORT}/__requests`)
	).json()) as RecordedRequest[]
	const orderId = sessions
		.filter((entry) => entry.path === '/v1/checkout/sessions')
		.map((entry) => entry.body['metadata[orderId]'])
		.at(-1)
	expect(orderId).toBeTruthy()

	// What Stripe would send once the card is charged.
	const payload = JSON.stringify({
		id: `evt_e2e_${run}`,
		object: 'event',
		type: 'checkout.session.completed',
		data: {
			object: {
				id: `cs_e2e_${run}`,
				object: 'checkout.session',
				payment_status: 'paid',
				payment_intent: `pi_e2e_${run}`,
				amount_total: 3900,
				metadata: { orderId },
			},
		},
	})
	const signature = await new Stripe('sk_test_fake').webhooks.generateTestHeaderStringAsync({
		payload,
		secret: 'whsec_test_integration',
	})
	const webhook = await request.post('/api/stripe/webhook', {
		data: payload,
		headers: { 'content-type': 'application/json', 'stripe-signature': signature },
	})
	expect(webhook.ok()).toBe(true)

	await goto(`/checkout/success?order=${orderId}`, { waitUntil: 'hydration' })
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('paid. nice find.')
	await expect(page.getByRole('link', { name: 'cart', exact: true })).toBeVisible()
})
