import { expect, test } from '@nuxt/test-utils/playwright'
import { dbQuery } from '../integration/helpers/db'
import { markShopChargesEnabled } from '../integration/helpers/shop'

test('admin reviews the marketplace, suspends and reinstates a shop, and sees it audited', async ({
	page,
	goto,
	playwright,
}) => {
	const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
	const consoleErrors: string[] = []
	page.on('pageerror', (error) => consoleErrors.push(error.message))

	const seller = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
	await seller.post('/api/auth/signup', {
		data: { name: 'Shady Seller', email: `shady-${run}@example.com`, password: 'Ab1!Ab1!' },
	})
	const shop = await (
		await seller.post('/api/v1/shop', {
			data: { name: `Shady Shop ${run}`, slug: `shady-${run}` },
		})
	).json()
	markShopChargesEnabled(shop.id)

	const email = `admin-${run}@example.com`
	await page.request.post('/api/auth/signup', {
		data: { name: 'Admin Person', email, password: 'Ab1!Ab1!' },
	})
	dbQuery(
		`await db.update(schema.users).set({ role: 'admin' }).where(eq(schema.users.email, '${email}'))`,
	)
	// The role is read into the session at login.
	await page.request.post('/api/auth/login', { data: { email, password: 'Ab1!Ab1!' } })

	await goto('/admin', { waitUntil: 'hydration' })
	await expect(page.getByRole('heading', { name: 'admin', exact: true })).toBeVisible()
	await expect(page.getByText('gross paid')).toBeVisible()

	await goto('/admin/shops', { waitUntil: 'hydration' })
	await page.getByRole('textbox', { name: 'search shops' }).fill(`shady-${run}`)
	await page.getByRole('textbox', { name: 'search shops' }).press('Enter')
	const row = page.getByRole('row', { name: new RegExp(`Shady Shop ${run}`, 'i') })
	await expect(row).toBeVisible()
	await row.getByRole('button', { name: 'suspend' }).click()

	const dialog = page.getByRole('dialog')
	await dialog.getByRole('button', { name: 'suspend shop' }).click()
	await expect(dialog.getByText('say why')).toBeVisible()
	await dialog.getByRole('textbox', { name: 'reason' }).fill(`counterfeit goods ${run}`)
	await dialog.getByRole('button', { name: 'suspend shop' }).click()
	await expect(row.getByText('suspended', { exact: true })).toBeVisible()
	expect((await seller.get(`/api/shops/shady-${run}`)).status()).toBe(404)

	await row.getByRole('button', { name: 'reinstate' }).click()
	await page
		.getByRole('dialog')
		.getByRole('textbox', { name: 'reason' })
		.fill(`appeal accepted ${run}`)
	await page.getByRole('dialog').getByRole('button', { name: 'reinstate shop' }).click()
	await expect(row.getByText('active', { exact: true })).toBeVisible()

	await goto('/admin', { waitUntil: 'hydration' })
	await expect(page.getByText(`“counterfeit goods ${run}”`)).toBeVisible()
	await expect(page.getByText(`“appeal accepted ${run}”`)).toBeVisible()

	await goto('/admin/transaction-logs', { waitUntil: 'hydration' })
	await expect(page.getByRole('heading', { name: 'transaction logs' })).toBeVisible()
	const exportLink = page.getByRole('link', { name: 'export csv' })
	await expect(exportLink).toHaveAttribute('href', '/api/admin/transaction-logs/export')
	await page.getByRole('textbox', { name: 'shop id' }).fill(shop.id)
	await page.getByRole('textbox', { name: 'shop id' }).press('Enter')
	await expect(exportLink).toHaveAttribute(
		'href',
		`/api/admin/transaction-logs/export?shopId=${shop.id}`,
	)

	expect(consoleErrors).toEqual([])
})
