import { expect, test } from '@nuxt/test-utils/playwright'

test('system design page renders the interactive diagrams', async ({ page, goto }) => {
	await goto('/system-design', { waitUntil: 'hydration' })

	const architecture = page.getByRole('figure', { name: 'high-level architecture diagram' })
	await expect(architecture.locator('.vue-flow__node').first()).toBeVisible()
	expect(await architecture.locator('.vue-flow__node').count()).toBeGreaterThan(0)
	await expect(architecture.locator('.vue-flow__edge').first()).toBeAttached()

	await architecture.getByRole('button', { name: 'zoom in' }).click()
	await expect(page.getByRole('link', { name: /03-architecture\.md/ }).first()).toHaveAttribute(
		'href',
		'https://github.com/AlexGalhardo/nuxtjs-marketplace/blob/main/docs/system-design/03-architecture.md',
	)
})
