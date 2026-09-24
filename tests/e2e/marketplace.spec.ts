import { expect, test } from '@nuxt/test-utils/playwright'
import type { ProductType } from '../../shared/types/db'
import { markShopChargesEnabled } from '../integration/helpers/shop'

test('buyer can search, filter and open a product and its shop', async ({ page, goto }) => {
	const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
	const token = `zq${run}`
	const api = page.request

	// Seller setup through the API; the seller UI itself is covered by my-shop.spec.ts.
	await api.post('/api/auth/signup', {
		data: { name: 'Market Seller', email: `market-${run}@example.com`, password: 'Ab1!Ab1!' },
	})
	const shop = await (
		await api.post('/api/v1/shop', {
			data: { name: `Market Shop ${run}`, slug: `market-${run}` },
		})
	).json()
	markShopChargesEnabled(shop.id)
	const types = (await (await api.get('/api/product-types')).json()) as ProductType[]
	const byKind = (kind: string) => types.find((type) => type.kind === kind)?.id
	for (const [title, kind, priceCents] of [
		[`${token} denim jacket`, 'physical', 4500],
		[`${token} lightroom presets`, 'digital', 900],
	] as const) {
		const product = await (
			await api.post('/api/v1/shop/products', {
				data: {
					productTypeId: byKind(kind),
					title,
					slug: `${kind}-${run}`,
					description: 'Listed by the marketplace e2e test.',
					priceCents,
					stock: 1,
				},
			})
		).json()
		expect((await api.post(`/api/v1/shop/products/${product.id}/publish`)).ok()).toBe(true)
	}

	await goto('/', { waitUntil: 'hydration' })
	await page.getByRole('searchbox', { name: 'search products' }).fill(token)
	await page.getByRole('searchbox', { name: 'search products' }).press('Enter')
	await expect(page).toHaveURL(new RegExp(`/marketplace\\?q=${token}`))
	await expect(page.getByText('2 finds')).toBeVisible()

	await page.getByRole('button', { name: 'digital', exact: true }).click()
	await expect(page).toHaveURL(/kind=digital/)
	await expect(page.getByText('1 find', { exact: true })).toBeVisible()

	await page.getByRole('link', { name: new RegExp(`${token} lightroom presets`) }).click()
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${token} lightroom presets`)
	await expect(page.getByText('$9.00')).toBeVisible()

	await page.getByRole('link', { name: /sold by/ }).click()
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Market Shop ${run}`)
	await expect(page.getByText('2 listings')).toBeVisible()
})

test('unknown products show the not-found page', async ({ page }) => {
	const response = await page.goto('/products/definitely-not-a-product')
	expect(response?.status()).toBe(404)
})
