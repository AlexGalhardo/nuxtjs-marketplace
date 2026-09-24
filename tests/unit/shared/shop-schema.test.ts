import { describe, expect, it } from 'vitest'
import { shopSchema, shopUpdateSchema } from '../../../shared/schemas/shop'

const validShop = { name: 'Alex Shop', slug: 'alex-shop', description: 'Cool stuff' }

describe('shopSchema', () => {
	it('accepts a valid shop', () => {
		expect(shopSchema.safeParse(validShop).success).toBe(true)
	})

	it('allows an optional description', () => {
		const { description, ...rest } = validShop
		expect(shopSchema.safeParse(rest).success).toBe(true)
	})

	it.each(['name', 'slug'])('requires %s', (field) => {
		expect(shopSchema.safeParse({ ...validShop, [field]: '' }).success).toBe(false)
	})

	it.each(['Alex Shop', 'alex_shop', 'alex shop', '-alex', 'alex-'])(
		'rejects an invalid slug (%s)',
		(slug) => {
			expect(shopSchema.safeParse({ ...validShop, slug }).success).toBe(false)
		},
	)

	it('accepts a slug with numbers and hyphens', () => {
		expect(shopSchema.safeParse({ ...validShop, slug: 'shop-2' }).success).toBe(true)
	})
})

describe('shopUpdateSchema', () => {
	it('has no slug field', () => {
		expect(shopUpdateSchema.safeParse({ name: 'Alex Shop', slug: 'ignored' }).success).toBe(
			true,
		)
		expect(shopUpdateSchema.parse({ name: 'Alex Shop' })).not.toHaveProperty('slug')
	})
})
