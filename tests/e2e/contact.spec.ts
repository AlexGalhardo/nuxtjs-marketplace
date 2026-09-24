import { expect, test } from '@nuxt/test-utils/playwright'

test('user can send a message from the contact page', async ({ page, goto }) => {
  await goto('/contact', { waitUntil: 'hydration' })

  await page.getByLabel('Name').fill('Jane Doe')
  await page.getByLabel('Email').fill('jane@example.com')
  await page.getByLabel('Subject').fill('Question about my order')
  await page.getByLabel('Message').fill('Hello, I have a question about my recent order.')
  await page.getByRole('button', { name: /send message/i }).click()

  await expect(page.getByText('Message sent')).toBeVisible()
})
