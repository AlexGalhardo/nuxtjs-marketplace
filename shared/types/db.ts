// Inferred from the SQLite schema; a test (tests/unit/db-schema-parity.test.ts) asserts the
// PostgreSQL schema exposes identical tables/columns, so these types apply to both dialects.
import type * as schema from '../../server/db/schema.sqlite'

export type User = typeof schema.users.$inferSelect
export type NewUser = typeof schema.users.$inferInsert

export type Address = typeof schema.addresses.$inferSelect
export type NewAddress = typeof schema.addresses.$inferInsert

export type PasswordResetToken = typeof schema.passwordResetTokens.$inferSelect
export type NewPasswordResetToken = typeof schema.passwordResetTokens.$inferInsert

export type Shop = typeof schema.shops.$inferSelect
export type NewShop = typeof schema.shops.$inferInsert

export type ApiToken = typeof schema.apiTokens.$inferSelect
export type NewApiToken = typeof schema.apiTokens.$inferInsert

export type ProductType = typeof schema.productTypes.$inferSelect
export type NewProductType = typeof schema.productTypes.$inferInsert

export type Product = typeof schema.products.$inferSelect
export type NewProduct = typeof schema.products.$inferInsert

export type ProductImage = typeof schema.productImages.$inferSelect
export type NewProductImage = typeof schema.productImages.$inferInsert

export type ProductFile = typeof schema.productFiles.$inferSelect
export type NewProductFile = typeof schema.productFiles.$inferInsert

export type CartItem = typeof schema.cartItems.$inferSelect
export type NewCartItem = typeof schema.cartItems.$inferInsert

export type Order = typeof schema.orders.$inferSelect
export type NewOrder = typeof schema.orders.$inferInsert

export type SellerOrder = typeof schema.sellerOrders.$inferSelect
export type NewSellerOrder = typeof schema.sellerOrders.$inferInsert

export type OrderItem = typeof schema.orderItems.$inferSelect
export type NewOrderItem = typeof schema.orderItems.$inferInsert

export type DownloadGrant = typeof schema.downloadGrants.$inferSelect
export type NewDownloadGrant = typeof schema.downloadGrants.$inferInsert

export type Review = typeof schema.reviews.$inferSelect
export type NewReview = typeof schema.reviews.$inferInsert

export type TransactionLog = typeof schema.transactionLogs.$inferSelect
export type NewTransactionLog = typeof schema.transactionLogs.$inferInsert

export type StripeEvent = typeof schema.stripeEvents.$inferSelect
export type NewStripeEvent = typeof schema.stripeEvents.$inferInsert

export type ContactMessage = typeof schema.contactMessages.$inferSelect
export type NewContactMessage = typeof schema.contactMessages.$inferInsert

export type AuditLog = typeof schema.auditLogs.$inferSelect
export type NewAuditLog = typeof schema.auditLogs.$inferInsert
