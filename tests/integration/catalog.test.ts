import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import type { CatalogItem } from '../../shared/types/catalog'
import type { ProductType } from '../../shared/types/db'
import { markShopChargesEnabled } from './helpers/shop'

type CatalogPage = { data: CatalogItem[]; meta: { page: number; perPage: number; total: number } }

const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
// A token no other test's product title contains, so `q` isolates this file's fixtures.
const token = `zq${run}`
const shopSlug = `catalog-${run}`
const slugs = { cheap: `cheap-${run}`, pricey: `pricey-${run}`, draft: `draft-${run}` }

async function createProduct(
	cookie: string,
	body: {
		productTypeId: string
		title: string
		slug: string
		priceCents: number
		stock?: number
	},
) {
	return $fetch<{ id: string }>('/api/v1/shop/products', {
		method: 'POST',
		headers: { cookie },
		body: { description: 'A catalog integration test product.', ...body },
	})
}

beforeAll(async () => {
	const signup = await fetch('/api/auth/signup', {
		method: 'POST',
		body: JSON.stringify({
			name: 'Catalog Seller',
			email: `catalog-${run}@example.com`,
			password: 'Ab1!Ab1!',
		}),
		headers: { 'content-type': 'application/json' },
	})
	const cookie = signup.headers.get('set-cookie')?.split(';')[0] ?? ''
	const shop = await $fetch<{ id: string }>('/api/v1/shop', {
		method: 'POST',
		headers: { cookie },
		body: { name: 'Catalog Shop', slug: shopSlug },
	})
	markShopChargesEnabled(shop.id)

	const types = await $fetch<ProductType[]>('/api/product-types')
	const physical = types.find((type) => type.kind === 'physical')
	const digital = types.find((type) => type.kind === 'digital')
	if (!physical || !digital) throw new Error('Expected seeded physical and digital product types')

	const cheap = await createProduct(cookie, {
		productTypeId: digital.id,
		title: `${token} cheap preset`,
		slug: slugs.cheap,
		priceCents: 500,
	})
	const pricey = await createProduct(cookie, {
		productTypeId: physical.id,
		title: `${token} pricey jacket`,
		slug: slugs.pricey,
		priceCents: 12_000,
		stock: 2,
	})
	await createProduct(cookie, {
		productTypeId: physical.id,
		title: `${token} unpublished draft`,
		slug: slugs.draft,
		priceCents: 3000,
		stock: 1,
	})
	for (const product of [cheap, pricey]) {
		await $fetch(`/api/v1/shop/products/${product.id}/publish`, {
			method: 'POST',
			headers: { cookie },
		})
	}
})

describe('GET /api/products', () => {
	it('lists only published products, newest first', async () => {
		const page = await $fetch<CatalogPage>('/api/products', { query: { q: token } })
		expect(page.meta.total).toBe(2)
		expect(page.data.map((item) => item.slug)).toEqual([slugs.pricey, slugs.cheap])
	})

	it('matches the search case-insensitively', async () => {
		const page = await $fetch<CatalogPage>('/api/products', {
			query: { q: `${token.toUpperCase()} PRICEY` },
		})
		expect(page.data.map((item) => item.slug)).toEqual([slugs.pricey])
	})

	it('filters by kind, shop and whole-dollar price range', async () => {
		const digital = await $fetch<CatalogPage>('/api/products', {
			query: { q: token, kind: 'digital' },
		})
		expect(digital.data.map((item) => item.slug)).toEqual([slugs.cheap])

		const byShop = await $fetch<CatalogPage>('/api/products', { query: { shop: shopSlug } })
		expect(byShop.meta.total).toBe(2)

		const ranged = await $fetch<CatalogPage>('/api/products', {
			query: { q: token, minPrice: 5, maxPrice: 5 },
		})
		expect(ranged.data.map((item) => item.slug)).toEqual([slugs.cheap])
	})

	it('sorts by price and paginates', async () => {
		const asc = await $fetch<CatalogPage>('/api/products', {
			query: { q: token, sort: 'price-asc', perPage: 1, page: 2 },
		})
		expect(asc.meta).toEqual({ page: 2, perPage: 1, total: 2 })
		expect(asc.data.map((item) => item.slug)).toEqual([slugs.pricey])
	})

	it('rejects an invalid query with 400', async () => {
		for (const query of [
			'minPrice=10&maxPrice=5',
			'sort=random',
			'perPage=500',
			'kind=vehicle',
		]) {
			const response = await fetch(`/api/products?${query}`)
			expect(response.status, query).toBe(400)
		}
	})
})

describe('GET /api/products/:slug', () => {
	it('returns a published product with its public shop', async () => {
		const product = await $fetch<Record<string, unknown> & { shop: Record<string, unknown> }>(
			`/api/products/${slugs.pricey}`,
		)
		expect(product).toMatchObject({ slug: slugs.pricey, priceCents: 12_000, images: [] })
		expect(product.shop.slug).toBe(shopSlug)
		expect(product.shop).not.toHaveProperty('ownerId')
		expect(product.shop).not.toHaveProperty('stripeAccountId')
	})

	it('returns 404 for drafts and unknown slugs', async () => {
		expect((await fetch(`/api/products/${slugs.draft}`)).status).toBe(404)
		expect((await fetch(`/api/products/nope-${run}`)).status).toBe(404)
	})
})

describe('GET /api/shops/:slug', () => {
	it('returns the public shop and 404s unknown shops', async () => {
		const shop = await $fetch<Record<string, unknown>>(`/api/shops/${shopSlug}`)
		expect(shop).toMatchObject({ slug: shopSlug, name: 'Catalog Shop' })
		expect(shop).not.toHaveProperty('ownerId')
		expect((await fetch(`/api/shops/nope-${run}`)).status).toBe(404)
	})
})

describe('GET /sitemap.xml', () => {
	it('lists published products and active shops, not drafts', async () => {
		const xml = await (await fetch('/sitemap.xml')).text()
		expect(xml).toContain(`/products/${slugs.cheap}</loc>`)
		expect(xml).toContain(`/shops/${shopSlug}</loc>`)
		expect(xml).not.toContain(slugs.draft)
	})
})
