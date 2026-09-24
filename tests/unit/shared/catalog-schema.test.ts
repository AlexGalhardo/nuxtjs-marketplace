import { describe, expect, it } from 'vitest'
import { catalogQuerySchema } from '../../../shared/schemas/catalog'

describe('catalogQuerySchema', () => {
	it('applies defaults to an empty query', () => {
		expect(catalogQuerySchema.parse({})).toEqual({ sort: 'newest', page: 1, perPage: 24 })
	})

	it('coerces query-string numbers and trims text', () => {
		expect(
			catalogQuerySchema.parse({ q: '  tee ', minPrice: '5', maxPrice: '20', page: '3' }),
		).toMatchObject({ q: 'tee', minPrice: 5, maxPrice: 20, page: 3 })
	})

	it('accepts an equal min and max price', () => {
		expect(catalogQuerySchema.safeParse({ minPrice: '10', maxPrice: '10' }).success).toBe(true)
	})

	it.each([
		['min above max', { minPrice: '20', maxPrice: '10' }],
		['negative price', { minPrice: '-1' }],
		['fractional price', { maxPrice: '9.5' }],
		['unknown sort', { sort: 'popular' }],
		['unknown kind', { kind: 'service' }],
		['page zero', { page: '0' }],
		['perPage too large', { perPage: '49' }],
		['search too long', { q: 'x'.repeat(101) }],
	])('rejects %s', (_label, query) => {
		expect(catalogQuerySchema.safeParse(query).success).toBe(false)
	})
})
