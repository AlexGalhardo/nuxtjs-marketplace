import type { OrderStatus, ProductKind, SellerOrderStatus } from './enums'

// GET /api/orders and GET /api/orders/:id (buyer side).
export interface BuyerOrderSummary {
	id: string
	status: OrderStatus
	totalCents: number
	itemCount: number
	createdAt: string
}

export interface BuyerDownload {
	id: string
	filename: string
	downloadsLeft: number
	expiresAt: string
	// null once the grant is used up, expired, or the order was refunded.
	url: string | null
}

export interface BuyerOrderItem {
	id: string
	productSlug: string
	title: string
	priceCents: number
	quantity: number
	kind: ProductKind
	downloads: BuyerDownload[]
	review: { rating: number; comment: string | null } | null
	canReview: boolean
}

export interface BuyerSellerOrder {
	id: string
	status: SellerOrderStatus
	shopName: string
	shopSlug: string
	subtotalCents: number
	shippingCents: number
	carrier: string | null
	trackingCode: string | null
	shippedAt: string | null
	items: BuyerOrderItem[]
}

export interface BuyerOrder {
	id: string
	status: OrderStatus
	subtotalCents: number
	shippingCents: number
	totalCents: number
	shippingAddress: Record<string, string | null> | null
	createdAt: string
	sellers: BuyerSellerOrder[]
}

// GET /api/v1/shop/orders (seller side).
export interface ShopOrder {
	id: string
	orderId: string
	status: SellerOrderStatus
	subtotalCents: number
	shippingCents: number
	feeCents: number
	payoutCents: number
	carrier: string | null
	trackingCode: string | null
	shippedAt: string | null
	createdAt: string
	buyerName: string
	shippingAddress: Record<string, string | null> | null
	items: { title: string; quantity: number; priceCents: number; kind: ProductKind }[]
}
