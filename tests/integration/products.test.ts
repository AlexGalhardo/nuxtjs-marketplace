import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import type { ProductType } from '../../shared/types/db'
import { markShopChargesEnabled } from './helpers/shop'

interface ShopResponse {
  id: string
  slug: string
}

interface ProductResponse {
  id: string
  slug: string
  status: string
  kind: string
  stock: number | null
  shippingCents: number
}

function uniqueEmail() {
  return `product-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extractSessionCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('Expected a Set-Cookie header')
  return setCookie.split(';')[0] as string
}

async function signUpAndCreateShop(email: string) {
  const signupResponse = await fetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Product Test', email, password: 'Ab1!Ab1!' }),
    headers: { 'content-type': 'application/json' },
  })
  const cookie = extractSessionCookie(signupResponse)
  const shop = await $fetch<ShopResponse>('/api/v1/shop', {
    method: 'POST',
    headers: { cookie },
    body: { name: 'Test Shop', slug: uniqueSlug('shop') },
  })
  return { cookie, shop }
}

describe('shop product endpoints', () => {
  it('rejects unauthenticated access', async () => {
    const response = await fetch('/api/v1/shop/products')
    expect(response.status).toBe(401)
  })

  it('rejects creating a product without a shop', async () => {
    const signupResponse = await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'No Shop', email: uniqueEmail(), password: 'Ab1!Ab1!' }),
      headers: { 'content-type': 'application/json' },
    })
    const cookie = extractSessionCookie(signupResponse)
    const productTypes = await $fetch<ProductType[]>('/api/product-types')

    const response = await fetch('/api/v1/shop/products', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        productTypeId: productTypes[0]?.id,
        title: 'Orphan product',
        slug: uniqueSlug('orphan'),
        description: 'Should not be created without a shop.',
        priceCents: 1000,
      }),
    })
    expect(response.status).toBe(404)
  })

  it('creates a physical product with derived kind and default stock', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const productTypes = await $fetch<ProductType[]>('/api/product-types')
    const physicalType = productTypes.find((type) => type.kind === 'physical')
    if (!physicalType) throw new Error('Expected a seeded physical product type')

    const product = await $fetch<ProductResponse>('/api/v1/shop/products', {
      method: 'POST',
      headers: { cookie },
      body: {
        productTypeId: physicalType.id,
        title: 'Mechanical Keyboard',
        slug: uniqueSlug('keyboard'),
        description: 'A great mechanical keyboard with RGB lighting.',
        priceCents: 8999,
        shippingCents: 500,
      },
    })

    expect(product.kind).toBe('physical')
    expect(product.status).toBe('draft')
    expect(product.stock).toBe(0)
    expect(product.shippingCents).toBe(500)
  })

  it('creates a digital product with null stock and zeroed shipping', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const productTypes = await $fetch<ProductType[]>('/api/product-types')
    const digitalType = productTypes.find((type) => type.kind === 'digital')
    if (!digitalType) throw new Error('Expected a seeded digital product type')

    const product = await $fetch<ProductResponse>('/api/v1/shop/products', {
      method: 'POST',
      headers: { cookie },
      body: {
        productTypeId: digitalType.id,
        title: 'Photoshop Presets',
        slug: uniqueSlug('presets'),
        description: 'A bundle of Photoshop presets for portrait editing.',
        priceCents: 1999,
        shippingCents: 500,
        stock: 10,
      },
    })

    expect(product.kind).toBe('digital')
    expect(product.stock).toBeNull()
    expect(product.shippingCents).toBe(0)
  })

  it('rejects a duplicate product slug', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const productTypes = await $fetch<ProductType[]>('/api/product-types')
    const type = productTypes[0]
    if (!type) throw new Error('Expected at least one seeded product type')
    const slug = uniqueSlug('dup')

    await $fetch('/api/v1/shop/products', {
      method: 'POST',
      headers: { cookie },
      body: {
        productTypeId: type.id,
        title: 'First',
        slug,
        description: 'The first product with this slug.',
        priceCents: 1000,
      },
    })

    const response = await fetch('/api/v1/shop/products', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        productTypeId: type.id,
        title: 'Second',
        slug,
        description: 'A different product using the same slug.',
        priceCents: 2000,
      }),
    })
    expect(response.status).toBe(409)
  })

  it('blocks publishing until the shop has completed Stripe onboarding, then allows it', async () => {
    const { cookie, shop } = await signUpAndCreateShop(uniqueEmail())
    const productTypes = await $fetch<ProductType[]>('/api/product-types')
    const type = productTypes[0]
    if (!type) throw new Error('Expected at least one seeded product type')

    const product = await $fetch<ProductResponse>('/api/v1/shop/products', {
      method: 'POST',
      headers: { cookie },
      body: {
        productTypeId: type.id,
        title: 'Gated Product',
        slug: uniqueSlug('gated'),
        description: 'A product that should not publish before onboarding.',
        priceCents: 1500,
      },
    })

    const blocked = await fetch(`/api/v1/shop/products/${product.id}/publish`, {
      method: 'POST',
      headers: { cookie },
    })
    expect(blocked.status).toBe(409)

    markShopChargesEnabled(shop.id)

    const published = await $fetch<ProductResponse>(`/api/v1/shop/products/${product.id}/publish`, {
      method: 'POST',
      headers: { cookie },
    })
    expect(published.status).toBe('published')
  })

  it("returns 403 when a different seller acts on another shop's product", async () => {
    const { cookie: ownerCookie } = await signUpAndCreateShop(uniqueEmail())
    const productTypes = await $fetch<ProductType[]>('/api/product-types')
    const type = productTypes[0]
    if (!type) throw new Error('Expected at least one seeded product type')

    const product = await $fetch<ProductResponse>('/api/v1/shop/products', {
      method: 'POST',
      headers: { cookie: ownerCookie },
      body: {
        productTypeId: type.id,
        title: 'Owned Product',
        slug: uniqueSlug('owned'),
        description: 'A product owned by the first seller.',
        priceCents: 1200,
      },
    })

    const { cookie: otherOwnerCookie } = await signUpAndCreateShop(uniqueEmail())
    const forbidden = await fetch(`/api/v1/shop/products/${product.id}`, {
      method: 'DELETE',
      headers: { cookie: otherOwnerCookie },
    })
    expect(forbidden.status).toBe(403)
  })

  it('returns 404 for a product id that does not exist', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const response = await fetch('/api/v1/shop/products/does-not-exist', {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(response.status).toBe(404)
  })

  it('lists only the current seller’s products, paginated', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const productTypes = await $fetch<ProductType[]>('/api/product-types')
    const type = productTypes[0]
    if (!type) throw new Error('Expected at least one seeded product type')

    for (let i = 0; i < 3; i++) {
      await $fetch('/api/v1/shop/products', {
        method: 'POST',
        headers: { cookie },
        body: {
          productTypeId: type.id,
          title: `Product ${i}`,
          slug: uniqueSlug(`list-${i}`),
          description: 'One of several products for the pagination test.',
          priceCents: 1000,
        },
      })
    }

    const page1 = await $fetch<{ data: ProductResponse[]; meta: { total: number } }>(
      '/api/v1/shop/products?page=1&perPage=2',
      { headers: { cookie } },
    )
    expect(page1.data).toHaveLength(2)
    expect(page1.meta.total).toBe(3)

    const page2 = await $fetch<{ data: ProductResponse[]; meta: { total: number } }>(
      '/api/v1/shop/products?page=2&perPage=2',
      { headers: { cookie } },
    )
    expect(page2.data).toHaveLength(1)
  })

  it('archives a published product', async () => {
    const { cookie, shop } = await signUpAndCreateShop(uniqueEmail())
    markShopChargesEnabled(shop.id)
    const productTypes = await $fetch<ProductType[]>('/api/product-types')
    const type = productTypes[0]
    if (!type) throw new Error('Expected at least one seeded product type')

    const product = await $fetch<ProductResponse>('/api/v1/shop/products', {
      method: 'POST',
      headers: { cookie },
      body: {
        productTypeId: type.id,
        title: 'Archive Me',
        slug: uniqueSlug('archive'),
        description: 'A product that will be published then archived.',
        priceCents: 1300,
      },
    })
    await $fetch(`/api/v1/shop/products/${product.id}/publish`, {
      method: 'POST',
      headers: { cookie },
    })

    const archived = await $fetch<ProductResponse>(`/api/v1/shop/products/${product.id}/archive`, {
      method: 'POST',
      headers: { cookie },
    })
    expect(archived.status).toBe('archived')
  })
})
