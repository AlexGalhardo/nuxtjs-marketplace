import { and, asc, count, desc, eq, gte, inArray, lte, type SQL, sql } from 'drizzle-orm'
import type { CatalogQuery } from '#shared/schemas/catalog'

// Public catalog visibility (PLAN.md D12): only published products of active shops that can take
// payments. Every public read goes through this, so a suspended shop disappears everywhere at once.
export function publicProductConditions(): SQL[] {
	return [
		eq(schema.products.status, 'published'),
		eq(schema.shops.status, 'active'),
		eq(schema.shops.chargesEnabled, true),
	]
}

const catalogColumns = {
	id: schema.products.id,
	slug: schema.products.slug,
	title: schema.products.title,
	kind: schema.products.kind,
	priceCents: schema.products.priceCents,
	shippingCents: schema.products.shippingCents,
	stock: schema.products.stock,
	ratingAvg: schema.products.ratingAvg,
	ratingCount: schema.products.ratingCount,
	createdAt: schema.products.createdAt,
	shopSlug: schema.shops.slug,
	shopName: schema.shops.name,
	typeSlug: schema.productTypes.slug,
	typeName: schema.productTypes.name,
}

export async function searchCatalog(query: CatalogQuery) {
	const conditions = publicProductConditions()
	if (query.q) {
		// Parameterized lower()+like works the same on SQLite and PostgreSQL (A05: no interpolation).
		conditions.push(sql`lower(${schema.products.title}) like ${`%${query.q.toLowerCase()}%`}`)
	}
	if (query.kind) conditions.push(eq(schema.products.kind, query.kind))
	if (query.type) conditions.push(eq(schema.productTypes.slug, query.type))
	if (query.shop) conditions.push(eq(schema.shops.slug, query.shop))
	if (query.minPrice !== undefined)
		conditions.push(gte(schema.products.priceCents, query.minPrice * 100))
	if (query.maxPrice !== undefined)
		conditions.push(lte(schema.products.priceCents, query.maxPrice * 100))
	const where = and(...conditions)

	const order = {
		newest: [desc(schema.products.createdAt), desc(schema.products.id)],
		'price-asc': [asc(schema.products.priceCents), desc(schema.products.createdAt)],
		'price-desc': [desc(schema.products.priceCents), desc(schema.products.createdAt)],
	}[query.sort]

	const [totalRow] = await db
		.select({ total: count() })
		.from(schema.products)
		.innerJoin(schema.shops, eq(schema.products.shopId, schema.shops.id))
		.innerJoin(schema.productTypes, eq(schema.products.productTypeId, schema.productTypes.id))
		.where(where)

	const rows = await db
		.select(catalogColumns)
		.from(schema.products)
		.innerJoin(schema.shops, eq(schema.products.shopId, schema.shops.id))
		.innerJoin(schema.productTypes, eq(schema.products.productTypeId, schema.productTypes.id))
		.where(where)
		.orderBy(...order)
		.limit(query.perPage)
		.offset((query.page - 1) * query.perPage)

	const covers = await coverImages(rows.map((row) => row.id))
	return {
		data: rows.map((row) => ({ ...row, coverPath: covers.get(row.id) ?? null })),
		meta: { page: query.page, perPage: query.perPage, total: totalRow?.total ?? 0 },
	}
}

async function coverImages(productIds: string[]) {
	const covers = new Map<string, string>()
	if (!productIds.length) return covers
	const images = await db
		.select({
			productId: schema.productImages.productId,
			blobPath: schema.productImages.blobPath,
		})
		.from(schema.productImages)
		.where(inArray(schema.productImages.productId, productIds))
		.orderBy(asc(schema.productImages.position))
	for (const image of images) {
		if (!covers.has(image.productId)) covers.set(image.productId, image.blobPath)
	}
	return covers
}

// Public shop fields only: never the owner id or Stripe account id.
export const publicShopColumns = {
	id: schema.shops.id,
	slug: schema.shops.slug,
	name: schema.shops.name,
	description: schema.shops.description,
	logoPath: schema.shops.logoPath,
	bannerPath: schema.shops.bannerPath,
	createdAt: schema.shops.createdAt,
}
