import { expect, test } from '@nuxt/test-utils/playwright'

test('user adds a shipping address; the CEP fills in the rest (ViaCEP)', async ({ page, goto }) => {
	const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
	await page.request.post('/api/auth/signup', {
		data: { name: 'Address Buyer', email: `addr-${run}@example.com`, password: 'Ab1!Ab1!' },
	})
	// ViaCEP is an external service: answer for it, so the test never depends on the network.
	await page.route('https://viacep.com.br/ws/01001000/json/', (route) =>
		route.fulfill({
			json: { logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' },
		}),
	)

	await goto('/profile', { waitUntil: 'hydration' })
	await page.getByRole('button', { name: 'Add address' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel('Full name').fill('Address Buyer')
	await dialog.getByLabel('Postal code (CEP)').fill('01001-000')
	await expect(dialog.getByLabel('Street and number')).toHaveValue('Praça da Sé')
	await expect(dialog.getByLabel('Neighborhood and complement')).toHaveValue('Sé')
	await expect(dialog.getByLabel('City')).toHaveValue('São Paulo')
	await expect(dialog.getByLabel('State')).toHaveValue('SP')
	await expect(dialog.getByLabel('Country (2-letter code)')).toHaveValue('BR')

	await dialog.getByLabel('Street and number').fill('Praça da Sé, 100')
	await dialog.getByLabel('Phone').fill('+55 11 99999-0000')
	await dialog.getByRole('button', { name: 'Save address' }).click()

	await expect(dialog).toBeHidden()
	await expect(page.getByText('Praça da Sé, 100')).toBeVisible()
})
