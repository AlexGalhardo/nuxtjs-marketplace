import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('GET /api/health', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    browser: false,
    env: { NUXT_STRICT_ENV: 'false' },
  })

  it('reports the server as healthy', async () => {
    expect(await $fetch('/api/health')).toEqual({ status: 'ok' })
  })

  it('sends security headers and hides the powered-by header', async () => {
    const response = await fetch('/api/health')

    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(response.headers.get('x-powered-by')).toBeNull()
  })
})
