import { expect, test } from '@nuxt/test-utils/playwright'
import { issueResetToken } from '../integration/helpers/reset-token'

function uniqueEmail() {
	return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

test('user can sign up, log out, log back in, and reset their password', async ({ page, goto }) => {
	const email = uniqueEmail()
	const password = 'Ab1!Ab1!'

	await goto('/signup', { waitUntil: 'hydration' })
	await page.getByLabel('Name').fill('E2E User')
	await page.getByLabel('Email').fill(email)
	await page.getByLabel('Password', { exact: true }).fill(password)
	await page.getByRole('button', { name: /create account/i }).click()

	await expect(page).toHaveURL('/')
	await expect(page.getByRole('button', { name: 'E2E User' })).toBeVisible()

	await page.getByRole('button', { name: 'E2E User' }).click()
	await page.getByRole('menuitem', { name: /log out/i }).click()
	await expect(page.getByRole('banner').getByRole('link', { name: /log in/i })).toBeVisible()

	await goto('/login', { waitUntil: 'hydration' })
	await page.getByLabel('Email').fill(email)
	await page.getByLabel('Password', { exact: true }).fill(password)
	await page.getByRole('button', { name: 'Log in', exact: true }).click()
	await expect(page.getByRole('button', { name: 'E2E User' })).toBeVisible()

	// No inbox in this environment: issue the reset token directly through the DB, the same way
	// it would be emailed by POST /api/auth/forgot-password.
	const meResponse = await page.request.get('/api/auth/me')
	const { user } = (await meResponse.json()) as { user: { id: string } }

	const rawToken = issueResetToken(user.id)

	await goto(`/reset-password?token=${rawToken}`, { waitUntil: 'hydration' })
	await page.getByLabel('New password').fill('NewPass1!')
	await page.getByRole('button', { name: /update password/i }).click()
	await expect(page).toHaveURL('/login')

	await page.getByLabel('Email').fill(email)
	await page.getByLabel('Password', { exact: true }).fill('NewPass1!')
	await page.getByRole('button', { name: 'Log in', exact: true }).click()
	await expect(page.getByRole('button', { name: 'E2E User' })).toBeVisible()
})
