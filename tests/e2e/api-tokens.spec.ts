import { expect, test } from '@nuxt/test-utils/playwright'

test('seller creates an API token, uses it, reads the docs and revokes it', async ({
	page,
	goto,
	request,
}) => {
	const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
	const consoleErrors: string[] = []
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text())
	})
	page.on('pageerror', (error) => consoleErrors.push(error.message))

	await page.request.post('/api/auth/signup', {
		data: {
			name: 'Token Seller',
			email: `token-seller-${run}@example.com`,
			password: 'Ab1!Ab1!',
		},
	})
	await page.request.post('/api/v1/shop', {
		data: { name: `Token Shop ${run}`, slug: `tok-${run}` },
	})

	await goto('/my-shop/api-tokens', { waitUntil: 'hydration' })
	await expect(page.getByText('no tokens yet')).toBeVisible()
	await page.getByRole('button', { name: 'new token' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByRole('textbox', { name: 'name' }).fill('e2e script')
	await dialog.getByRole('checkbox', { name: 'shop:read' }).click()
	await dialog.getByRole('button', { name: 'create token' }).click()

	const secret = page.locator('code', { hasText: /^rs_/ })
	await expect(secret).toBeVisible()
	const token = (await secret.textContent())?.trim() ?? ''
	const shop = await request.get('/api/v1/shop', {
		headers: { authorization: `Bearer ${token}` },
	})
	expect(((await shop.json()) as { slug: string }).slug).toBe(`tok-${run}`)

	await page.getByRole('button', { name: 'done' }).click()
	await expect(page.getByText('e2e script')).toBeVisible()
	await expect(page.getByText('shop:read', { exact: true })).toBeVisible()

	await goto('/my-shop/api-docs', { waitUntil: 'hydration' })
	await expect(page.getByText('resell.sh seller API').first()).toBeVisible({ timeout: 15_000 })
	await page.screenshot({
		path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/api-docs.png` : undefined,
	})
	await expect(page.getByText('Get your shop').first()).toBeVisible()

	await goto('/my-shop/api-tokens', { waitUntil: 'hydration' })
	await page.getByRole('button', { name: 'revoke' }).click()
	await page.getByRole('dialog').getByRole('button', { name: 'revoke token' }).click()
	await expect(page.getByText('revoked', { exact: true })).toBeVisible()
	const refused = await request.get('/api/v1/shop', {
		headers: { authorization: `Bearer ${token}` },
	})
	expect(refused.status()).toBe(401)

	expect(consoleErrors).toEqual([])
})
