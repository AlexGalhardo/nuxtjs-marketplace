import { $fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import type { ProductType } from '../../shared/types/db'

describe('GET /api/product-types', () => {
	it('lists the seeded product types (requires bun run db:migrate && bun run db:seed)', async () => {
		const productTypes = await $fetch<ProductType[]>('/api/product-types')

		expect(productTypes.length).toBeGreaterThanOrEqual(12)
		expect(productTypes.map((type) => type.slug)).toContain('electronics')
		expect(
			productTypes.every((type) => type.kind === 'physical' || type.kind === 'digital'),
		).toBe(true)
	})
})
