import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import type { ProductType } from '../../shared/types/db'

describe('GET /api/product-types', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    browser: false,
    env: { NUXT_STRICT_ENV: 'false' },
  })

  it('lists the seeded product types (requires bun run db:migrate && bun run db:seed)', async () => {
    const productTypes = await $fetch<ProductType[]>('/api/product-types')

    expect(productTypes.length).toBeGreaterThanOrEqual(12)
    expect(productTypes.map((type) => type.slug)).toContain('electronics')
    expect(productTypes.every((type) => type.kind === 'physical' || type.kind === 'digital')).toBe(
      true,
    )
  })
})
