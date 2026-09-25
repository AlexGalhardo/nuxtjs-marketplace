import type { ProductKind } from './enums'

// GET /api/cart (server/utils/cart.ts). `problem` is set when the line can't be checked out as-is.
export interface CartLine {
	productId: string
	slug: string
	title: string
	kind: ProductKind
	priceCents: number
	shippingCents: number
	stock: number | null
	quantity: number
	coverPath: string | null
	shopId: string
	shopSlug: string
	shopName: string
	problem: 'unavailable' | 'out_of_stock' | 'not_enough_stock' | null
}

export interface CartGroup {
	shopId: string
	shopSlug: string
	shopName: string
	lines: CartLine[]
	subtotalCents: number
	shippingCents: number
}

export interface Cart {
	groups: CartGroup[]
	count: number
	subtotalCents: number
	shippingCents: number
	totalCents: number
	hasPhysical: boolean
	canCheckout: boolean
}
