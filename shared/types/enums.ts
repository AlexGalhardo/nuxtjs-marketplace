// Enums are stored as plain text columns (see docs/database.md); these unions are the source of truth.
export type UserRole = 'user' | 'admin'
export type ShopStatus = 'active' | 'suspended'
export type ProductKind = 'physical' | 'digital'
export type ProductStatus = 'draft' | 'published' | 'archived' | 'suspended'
export type OrderStatus =
	| 'pending'
	| 'paid'
	| 'partially_refunded'
	| 'refunded'
	| 'canceled'
	| 'expired'
export type SellerOrderStatus =
	| 'pending'
	| 'paid'
	| 'shipped'
	| 'delivered'
	| 'refunded'
	| 'canceled'
