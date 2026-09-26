import { expect, test } from '@nuxt/test-utils/playwright'
import { markShopChargesEnabled } from '../integration/helpers/shop'

function uniqueEmail() {
	return `e2e-shop-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

function uniqueSlug(prefix: string) {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

test('seller can create a shop, create a product, and publish it once onboarded', async ({
	page,
	goto,
}) => {
	const email = uniqueEmail()

	await goto('/signup', { waitUntil: 'hydration' })
	await page.getByLabel('Name').fill('Seller E2E')
	await page.getByLabel('Email').fill(email)
	await page.getByLabel('Password', { exact: true }).fill('Ab1!Ab1!')
	await page.getByRole('button', { name: /create account/i }).click()
	await expect(page).toHaveURL('/')

	await goto('/my-shop', { waitUntil: 'hydration' })
	await page.getByLabel('Shop name').fill('E2E Test Shop')
	const slug = uniqueSlug('e2e-shop')
	await page.getByLabel('Shop URL').fill(slug)
	await page.getByRole('button', { name: /create shop/i }).click()
	await expect(page.getByText('E2E Test Shop', { exact: true })).toBeVisible()

	// Simulates the Stripe `account.updated` webhook completing onboarding (Phase 8 wires the real
	// checkout flow; this test focuses on the product create/publish gate, not Stripe Connect
	// itself, matching docs/testing.md's "e2e uses test-mode keys when available" rule).
	const shopResponse = await page.request.get('/api/v1/shop')
	const shop = (await shopResponse.json()) as { id: string }
	markShopChargesEnabled(shop.id)

	await goto('/my-shop/products/new', { waitUntil: 'hydration' })
	await page.getByLabel('Category').click()
	await page.getByRole('option').first().click()
	// The menu keeps focus trapped until its close animation ends; typing earlier is lost.
	await expect(page.getByRole('listbox')).toBeHidden()
	await page.getByLabel('Title').fill('E2E Wireless Mouse')
	const productSlug = uniqueSlug('e2e-mouse')
	await page.getByLabel('Product URL').fill(productSlug)
	await page.getByLabel('Description').fill('A wireless mouse created during an e2e test run.')
	await page.getByLabel('Price (cents)').fill('2999')
	await page.getByRole('button', { name: /create product/i }).click()

	await expect(page).toHaveURL(/\/my-shop\/products\/.+\/edit/)

	// Photos are downscaled in the browser before upload (app/utils/shrink-image.ts).
	const productId = page.url().match(/products\/([^/]+)\/edit/)?.[1]
	const hugePng = await page.evaluate(async () => {
		const canvas = new OffscreenCanvas(3000, 2000)
		const context = canvas.getContext('2d')
		for (let x = 0; x < 3000; x += 50) {
			if (!context) break
			context.fillStyle = `hsl(${x % 360} 80% 50%)`
			context.fillRect(x, 0, 50, 2000)
		}
		const blob = await canvas.convertToBlob({ type: 'image/png' })
		return Array.from(new Uint8Array(await blob.arrayBuffer()))
	})
	await page
		.locator('input[type="file"]')
		.first()
		.setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.from(hugePng) })
	const imagesUrl = `/api/v1/shop/products/${productId}/images`
	type Image = { blobPath: string }
	await expect
		.poll(async () => ((await (await page.request.get(imagesUrl)).json()) as Image[]).length)
		.toBe(1)
	const [image] = (await (await page.request.get(imagesUrl)).json()) as Image[]
	expect(image?.blobPath).toMatch(/huge-[0-9a-f]+\.webp$/)
	const longestEdge = await page.evaluate(async (src) => {
		const bitmap = await createImageBitmap(await (await fetch(src)).blob())
		return Math.max(bitmap.width, bitmap.height)
	}, `/${image?.blobPath}`)
	expect(longestEdge).toBe(1600)

	await goto('/my-shop/products', { waitUntil: 'hydration' })
	await expect(page.getByText('E2E Wireless Mouse')).toBeVisible()
	await page.getByRole('button', { name: /publish/i }).click()
	await expect(page.getByText('published', { exact: true })).toBeVisible()
})
