import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const validMessage = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Question about my order',
  message: 'Hello, I have a question about my recent order. Can you help?',
}

describe('POST /api/contact', () => {
  it('accepts a valid contact message', async () => {
    const response = await $fetch('/api/contact', { method: 'POST', body: validMessage })
    expect(response).toEqual({ success: true })
  })

  it('rejects an invalid payload', async () => {
    const response = await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify({ ...validMessage, email: 'not-an-email' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(400)
  })

  it('rejects a message that is too short', async () => {
    const response = await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify({ ...validMessage, message: 'too short' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(400)
  })
})
