import { describe, expect, it } from 'vitest'
import { productSchema } from '../../../shared/schemas/product'

const validProduct = {
  productTypeId: 'type-1',
  title: 'Wireless Mouse',
  slug: 'wireless-mouse',
  description: 'A great wireless mouse with a long battery life.',
  priceCents: 2999,
  shippingCents: 500,
  stock: 10,
}

describe('productSchema', () => {
  it('accepts a valid product', () => {
    expect(productSchema.safeParse(validProduct).success).toBe(true)
  })

  it('defaults shippingCents to 0 and leaves stock optional', () => {
    const { shippingCents, stock, ...rest } = validProduct
    const result = productSchema.parse(rest)
    expect(result.shippingCents).toBe(0)
    expect(result.stock).toBeUndefined()
  })

  it('rejects a price below 1 cent', () => {
    expect(productSchema.safeParse({ ...validProduct, priceCents: 0 }).success).toBe(false)
  })

  it('rejects a description shorter than 10 characters', () => {
    expect(productSchema.safeParse({ ...validProduct, description: 'too short' }).success).toBe(
      false,
    )
  })

  it('rejects an invalid slug', () => {
    expect(productSchema.safeParse({ ...validProduct, slug: 'Not A Slug!' }).success).toBe(false)
  })

  it.each(['productTypeId', 'title', 'slug'])('requires %s', (field) => {
    expect(productSchema.safeParse({ ...validProduct, [field]: '' }).success).toBe(false)
  })
})
