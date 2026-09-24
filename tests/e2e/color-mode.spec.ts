import { expect, test } from '@nuxt/test-utils/playwright'

test.use({ colorScheme: 'light' })

test('user can switch to dark mode from the header', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const html = page.locator('html')
  await expect(html).toHaveClass(/light/)

  await page.getByRole('button', { name: /switch to dark mode/i }).click()

  await expect(html).toHaveClass(/dark/)
})
