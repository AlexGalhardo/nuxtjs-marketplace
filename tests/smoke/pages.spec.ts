import { expect, test } from '@nuxt/test-utils/playwright'

// Every public page must load, hydrate and render without console errors (CSP violations included)
const publicPages = [
  { path: '/', heading: /./ },
  { path: '/contact', heading: /./ },
  { path: '/terms', heading: /./ },
  { path: '/privacy', heading: /./ },
]

for (const { path, heading } of publicPages) {
  test(`${path} renders without errors`, async ({ page, goto }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => consoleErrors.push(error.message))

    await goto(path, { waitUntil: 'hydration' })

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    expect(consoleErrors).toEqual([])
  })
}

test('health endpoint responds', async ({ request }) => {
  const response = await request.get('/api/health')

  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({ status: 'ok' })
})
