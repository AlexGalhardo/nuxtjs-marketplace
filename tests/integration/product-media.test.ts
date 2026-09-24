import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import type { ProductType } from '../../shared/types/db'

interface ShopResponse {
  id: string
  slug: string
  logoPath: string | null
  bannerPath: string | null
}

interface ProductResponse {
  id: string
  kind: string
}

interface ProductImage {
  id: string
  productId: string
  blobPath: string
  alt: string | null
  position: number
}

interface ProductFile {
  id: string
  productId: string
  filename: string
  size: number
  contentType: string
}

function uniqueEmail() {
  return `media-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extractSessionCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('Expected a Set-Cookie header')
  return setCookie.split(';')[0] as string
}

function pngBlob() {
  // Minimal valid PNG signature bytes are not required: ensureBlob() only checks the File's
  // declared MIME type, not its contents.
  return new File([new Uint8Array([1, 2, 3, 4])], 'photo.png', { type: 'image/png' })
}

async function signUpAndCreateShop(email: string) {
  const signupResponse = await fetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Media Test', email, password: 'Ab1!Ab1!' }),
    headers: { 'content-type': 'application/json' },
  })
  const cookie = extractSessionCookie(signupResponse)
  const shop = await $fetch<ShopResponse>('/api/v1/shop', {
    method: 'POST',
    headers: { cookie },
    body: { name: 'Media Shop', slug: uniqueSlug('media-shop') },
  })
  return { cookie, shop }
}

async function createProduct(cookie: string, kind: 'physical' | 'digital') {
  const productTypes = await $fetch<ProductType[]>('/api/product-types')
  const type = productTypes.find((entry) => entry.kind === kind)
  if (!type) throw new Error(`Expected a seeded ${kind} product type`)

  return $fetch<ProductResponse>('/api/v1/shop/products', {
    method: 'POST',
    headers: { cookie },
    body: {
      productTypeId: type.id,
      title: `Media ${kind} product`,
      slug: uniqueSlug(`media-${kind}`),
      description: 'A product used to exercise image/file upload endpoints.',
      priceCents: 1500,
    },
  })
}

describe('shop product image endpoints', () => {
  it('rejects unauthenticated access', async () => {
    const response = await fetch('/api/v1/shop/products/does-not-exist/images')
    expect(response.status).toBe(401)
  })

  it('uploads, lists, updates alt text, reorders and deletes product images', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const product = await createProduct(cookie, 'physical')

    const form = new FormData()
    form.append('files', pngBlob())
    form.append('files', pngBlob())
    const uploaded = await $fetch<ProductImage[]>(`/api/v1/shop/products/${product.id}/images`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    expect(uploaded).toHaveLength(2)
    expect(uploaded[0]?.position).toBe(0)
    expect(uploaded[1]?.position).toBe(1)

    const listed = await $fetch<ProductImage[]>(`/api/v1/shop/products/${product.id}/images`, {
      headers: { cookie },
    })
    expect(listed).toHaveLength(2)

    const firstImage = listed[0]
    if (!firstImage) throw new Error('Expected at least one uploaded image')
    const updated = await $fetch<ProductImage>(
      `/api/v1/shop/products/${product.id}/images/${firstImage.id}`,
      { method: 'PATCH', headers: { cookie }, body: { alt: 'Front view' } },
    )
    expect(updated.alt).toBe('Front view')

    const reordered = await $fetch<ProductImage[]>(
      `/api/v1/shop/products/${product.id}/images/reorder`,
      {
        method: 'POST',
        headers: { cookie },
        body: { order: [listed[1]?.id, listed[0]?.id] },
      },
    )
    expect(reordered.map((image) => image.id)).toEqual([listed[1]?.id, listed[0]?.id])

    const deleteResponse = await fetch(
      `/api/v1/shop/products/${product.id}/images/${firstImage.id}`,
      { method: 'DELETE', headers: { cookie } },
    )
    expect(deleteResponse.status).toBe(200)

    const afterDelete = await $fetch<ProductImage[]>(`/api/v1/shop/products/${product.id}/images`, {
      headers: { cookie },
    })
    expect(afterDelete).toHaveLength(1)
  })

  it('rejects a non-image file with 400', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const product = await createProduct(cookie, 'physical')

    const form = new FormData()
    form.append('files', new File(['not an image'], 'notes.txt', { type: 'text/plain' }))
    const response = await fetch(`/api/v1/shop/products/${product.id}/images`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    expect(response.status).toBe(400)
  })

  it('rejects an oversized image with 400', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const product = await createProduct(cookie, 'physical')

    const form = new FormData()
    const oversized = new File([new Uint8Array(5 * 1024 * 1024)], 'huge.png', {
      type: 'image/png',
    })
    form.append('files', oversized)
    const response = await fetch(`/api/v1/shop/products/${product.id}/images`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    expect(response.status).toBe(400)
  })

  it("returns 403 when a different seller acts on another shop's product images", async () => {
    const { cookie: ownerCookie } = await signUpAndCreateShop(uniqueEmail())
    const product = await createProduct(ownerCookie, 'physical')

    const { cookie: otherCookie } = await signUpAndCreateShop(uniqueEmail())
    const response = await fetch(`/api/v1/shop/products/${product.id}/images`, {
      headers: { cookie: otherCookie },
    })
    expect(response.status).toBe(403)
  })
})

describe('shop product file endpoints', () => {
  it('rejects uploading files to a physical product', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const product = await createProduct(cookie, 'physical')

    const form = new FormData()
    form.append('files', new File(['digital content'], 'ebook.pdf', { type: 'application/pdf' }))
    const response = await fetch(`/api/v1/shop/products/${product.id}/files`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    expect(response.status).toBe(400)
  })

  it('uploads, lists and deletes digital product files', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const product = await createProduct(cookie, 'digital')

    const form = new FormData()
    form.append('files', new File(['digital content'], 'ebook.pdf', { type: 'application/pdf' }))
    const uploaded = await $fetch<ProductFile[]>(`/api/v1/shop/products/${product.id}/files`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    expect(uploaded).toHaveLength(1)
    expect(uploaded[0]?.filename).toBe('ebook.pdf')
    expect(uploaded[0]?.contentType).toBe('application/pdf')

    const listed = await $fetch<ProductFile[]>(`/api/v1/shop/products/${product.id}/files`, {
      headers: { cookie },
    })
    expect(listed).toHaveLength(1)

    const firstFile = listed[0]
    if (!firstFile) throw new Error('Expected an uploaded file')
    const deleteResponse = await fetch(
      `/api/v1/shop/products/${product.id}/files/${firstFile.id}`,
      {
        method: 'DELETE',
        headers: { cookie },
      },
    )
    expect(deleteResponse.status).toBe(200)

    const afterDelete = await $fetch<ProductFile[]>(`/api/v1/shop/products/${product.id}/files`, {
      headers: { cookie },
    })
    expect(afterDelete).toHaveLength(0)
  })

  it("returns 403 when a different seller acts on another shop's product files", async () => {
    const { cookie: ownerCookie } = await signUpAndCreateShop(uniqueEmail())
    const product = await createProduct(ownerCookie, 'digital')

    const { cookie: otherCookie } = await signUpAndCreateShop(uniqueEmail())
    const response = await fetch(`/api/v1/shop/products/${product.id}/files`, {
      headers: { cookie: otherCookie },
    })
    expect(response.status).toBe(403)
  })
})

describe('shop branding endpoints', () => {
  it('rejects an invalid kind', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const form = new FormData()
    form.append('file', pngBlob())
    const response = await fetch('/api/v1/shop/branding/avatar', {
      method: 'PUT',
      headers: { cookie },
      body: form,
    })
    expect(response.status).toBe(400)
  })

  it('uploads a logo and replaces a previously uploaded one', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())

    const first = await $fetch<ShopResponse>('/api/v1/shop/branding/logo', {
      method: 'PUT',
      headers: { cookie },
      body: (() => {
        const form = new FormData()
        form.append('file', pngBlob())
        return form
      })(),
    })
    expect(first.logoPath).toBeTruthy()

    const second = await $fetch<ShopResponse>('/api/v1/shop/branding/logo', {
      method: 'PUT',
      headers: { cookie },
      body: (() => {
        const form = new FormData()
        form.append('file', pngBlob())
        return form
      })(),
    })
    expect(second.logoPath).toBeTruthy()
    expect(second.logoPath).not.toBe(first.logoPath)
  })

  it('rejects a non-image branding file with 400', async () => {
    const { cookie } = await signUpAndCreateShop(uniqueEmail())
    const form = new FormData()
    form.append('file', new File(['not an image'], 'notes.txt', { type: 'text/plain' }))
    const response = await fetch('/api/v1/shop/branding/banner', {
      method: 'PUT',
      headers: { cookie },
      body: form,
    })
    expect(response.status).toBe(400)
  })
})
