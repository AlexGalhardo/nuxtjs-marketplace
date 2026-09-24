import type { ProductKind } from './enums'

// What a product card needs; GET /api/products returns these (server/utils/catalog.ts).
export interface CatalogItem {
	id: string
	slug: string
	title: string
	kind: ProductKind
	priceCents: number
	shippingCents: number
	stock: number | null
	shopSlug: string
	shopName: string
	typeSlug: string
	typeName: string
	coverPath: string | null
}
