import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { newId } from '../../shared/utils/id'

// Explicit import (not relying on Nuxt auto-imports): this file is also loaded directly by
// server/db/seed.ts and server/db/reset.ts, which run as plain Bun scripts outside the Nitro build.

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => newId())

const createdAt = () =>
	integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())

const updatedAt = () =>
	integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())

export const users = sqliteTable('users', {
	id: id(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role').$type<UserRole>().notNull().default('user'),
	phone: text('phone'),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
})

export const addresses = sqliteTable(
	'addresses',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		fullName: text('full_name').notNull(),
		line1: text('line1').notNull(),
		line2: text('line2'),
		city: text('city').notNull(),
		state: text('state').notNull(),
		postalCode: text('postal_code').notNull(),
		country: text('country').notNull(),
		phone: text('phone').notNull(),
		isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index('addresses_user_idx').on(table.userId)],
)

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
	id: id(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	tokenHash: text('token_hash').notNull().unique(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	usedAt: integer('used_at', { mode: 'timestamp' }),
	createdAt: createdAt(),
})

export const shops = sqliteTable('shops', {
	id: id(),
	ownerId: text('owner_id')
		.notNull()
		.unique()
		.references(() => users.id),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	description: text('description'),
	logoPath: text('logo_path'),
	bannerPath: text('banner_path'),
	stripeAccountId: text('stripe_account_id'),
	chargesEnabled: integer('charges_enabled', { mode: 'boolean' }).notNull().default(false),
	payoutsEnabled: integer('payouts_enabled', { mode: 'boolean' }).notNull().default(false),
	status: text('status').$type<ShopStatus>().notNull().default('active'),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
})

export const apiTokens = sqliteTable(
	'api_tokens',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		shopId: text('shop_id')
			.notNull()
			.references(() => shops.id),
		name: text('name').notNull(),
		prefix: text('prefix').notNull(),
		tokenHash: text('token_hash').notNull().unique(),
		scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
		lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
		expiresAt: integer('expires_at', { mode: 'timestamp' }),
		revokedAt: integer('revoked_at', { mode: 'timestamp' }),
		createdAt: createdAt(),
	},
	(table) => [index('api_tokens_user_idx').on(table.userId)],
)

export const productTypes = sqliteTable('product_types', {
	id: id(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	kind: text('kind').$type<ProductKind>().notNull(),
})

export const products = sqliteTable(
	'products',
	{
		id: id(),
		shopId: text('shop_id')
			.notNull()
			.references(() => shops.id),
		productTypeId: text('product_type_id')
			.notNull()
			.references(() => productTypes.id),
		kind: text('kind').$type<ProductKind>().notNull(),
		title: text('title').notNull(),
		slug: text('slug').notNull().unique(),
		description: text('description').notNull(),
		priceCents: integer('price_cents').notNull(),
		shippingCents: integer('shipping_cents').notNull().default(0),
		stock: integer('stock'),
		status: text('status').$type<ProductStatus>().notNull().default('draft'),
		ratingAvg: real('rating_avg').notNull().default(0),
		ratingCount: integer('rating_count').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index('products_shop_created_idx').on(table.shopId, table.createdAt),
		index('products_type_idx').on(table.productTypeId),
		index('products_status_created_idx').on(table.status, table.createdAt),
	],
)

export const productImages = sqliteTable(
	'product_images',
	{
		id: id(),
		productId: text('product_id')
			.notNull()
			.references(() => products.id),
		blobPath: text('blob_path').notNull(),
		alt: text('alt'),
		position: integer('position').notNull().default(0),
	},
	(table) => [index('product_images_product_idx').on(table.productId)],
)

export const productFiles = sqliteTable(
	'product_files',
	{
		id: id(),
		productId: text('product_id')
			.notNull()
			.references(() => products.id),
		blobPath: text('blob_path').notNull(),
		filename: text('filename').notNull(),
		size: integer('size').notNull(),
		contentType: text('content_type').notNull(),
	},
	(table) => [index('product_files_product_idx').on(table.productId)],
)

export const cartItems = sqliteTable(
	'cart_items',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		productId: text('product_id')
			.notNull()
			.references(() => products.id),
		quantity: integer('quantity').notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [uniqueIndex('cart_items_user_product_unique').on(table.userId, table.productId)],
)

export const orders = sqliteTable(
	'orders',
	{
		id: id(),
		buyerId: text('buyer_id')
			.notNull()
			.references(() => users.id),
		status: text('status').$type<OrderStatus>().notNull().default('pending'),
		subtotalCents: integer('subtotal_cents').notNull(),
		shippingCents: integer('shipping_cents').notNull(),
		feeCents: integer('fee_cents').notNull(),
		totalCents: integer('total_cents').notNull(),
		currency: text('currency').notNull().default('usd'),
		stripeCheckoutSessionId: text('stripe_checkout_session_id'),
		stripePaymentIntentId: text('stripe_payment_intent_id'),
		shippingAddress: text('shipping_address', { mode: 'json' }).$type<Record<
			string,
			unknown
		> | null>(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index('orders_buyer_created_idx').on(table.buyerId, table.createdAt),
		index('orders_checkout_session_idx').on(table.stripeCheckoutSessionId),
	],
)

export const sellerOrders = sqliteTable(
	'seller_orders',
	{
		id: id(),
		orderId: text('order_id')
			.notNull()
			.references(() => orders.id),
		shopId: text('shop_id')
			.notNull()
			.references(() => shops.id),
		status: text('status').$type<SellerOrderStatus>().notNull().default('pending'),
		subtotalCents: integer('subtotal_cents').notNull(),
		shippingCents: integer('shipping_cents').notNull(),
		feeCents: integer('fee_cents').notNull(),
		payoutCents: integer('payout_cents').notNull(),
		stripeTransferId: text('stripe_transfer_id'),
		carrier: text('carrier'),
		trackingCode: text('tracking_code'),
		shippedAt: integer('shipped_at', { mode: 'timestamp' }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index('seller_orders_order_idx').on(table.orderId),
		index('seller_orders_shop_created_idx').on(table.shopId, table.createdAt),
	],
)

export const orderItems = sqliteTable(
	'order_items',
	{
		id: id(),
		sellerOrderId: text('seller_order_id')
			.notNull()
			.references(() => sellerOrders.id),
		productId: text('product_id')
			.notNull()
			.references(() => products.id),
		title: text('title').notNull(),
		priceCents: integer('price_cents').notNull(),
		quantity: integer('quantity').notNull(),
		kind: text('kind').$type<ProductKind>().notNull(),
		createdAt: createdAt(),
	},
	(table) => [index('order_items_seller_order_idx').on(table.sellerOrderId)],
)

export const downloadGrants = sqliteTable(
	'download_grants',
	{
		id: id(),
		orderItemId: text('order_item_id')
			.notNull()
			.references(() => orderItems.id),
		buyerId: text('buyer_id')
			.notNull()
			.references(() => users.id),
		productFileId: text('product_file_id')
			.notNull()
			.references(() => productFiles.id),
		downloadCount: integer('download_count').notNull().default(0),
		maxDownloads: integer('max_downloads').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		createdAt: createdAt(),
	},
	(table) => [index('download_grants_order_item_idx').on(table.orderItemId)],
)

export const reviews = sqliteTable(
	'reviews',
	{
		id: id(),
		productId: text('product_id')
			.notNull()
			.references(() => products.id),
		buyerId: text('buyer_id')
			.notNull()
			.references(() => users.id),
		orderItemId: text('order_item_id')
			.notNull()
			.references(() => orderItems.id),
		rating: integer('rating').notNull(),
		comment: text('comment'),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [uniqueIndex('reviews_product_buyer_unique').on(table.productId, table.buyerId)],
)

// Append-only: insert only, never update or delete (docs/database.md).
export const transactionLogs = sqliteTable(
	'transaction_logs',
	{
		id: id(),
		type: text('type').notNull(),
		orderId: text('order_id').references(() => orders.id),
		sellerOrderId: text('seller_order_id').references(() => sellerOrders.id),
		shopId: text('shop_id').references(() => shops.id),
		userId: text('user_id').references(() => users.id),
		stripeObjectId: text('stripe_object_id'),
		amountCents: integer('amount_cents').notNull(),
		currency: text('currency').notNull().default('usd'),
		status: text('status').notNull(),
		payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
		createdAt: createdAt(),
	},
	(table) => [
		index('transaction_logs_order_idx').on(table.orderId),
		index('transaction_logs_created_idx').on(table.createdAt),
	],
)

export const stripeEvents = sqliteTable('stripe_events', {
	id: text('id').primaryKey(),
	type: text('type').notNull(),
	receivedAt: integer('received_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	processedAt: integer('processed_at', { mode: 'timestamp' }),
	payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
})

export const contactMessages = sqliteTable('contact_messages', {
	id: id(),
	name: text('name').notNull(),
	email: text('email').notNull(),
	subject: text('subject').notNull(),
	message: text('message').notNull(),
	createdAt: createdAt(),
})

// Append-only: insert only, never update or delete (docs/database.md).
export const auditLogs = sqliteTable(
	'audit_logs',
	{
		id: id(),
		actorId: text('actor_id').references(() => users.id),
		action: text('action').notNull(),
		targetType: text('target_type').notNull(),
		targetId: text('target_id'),
		metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown> | null>(),
		createdAt: createdAt(),
	},
	(table) => [index('audit_logs_created_idx').on(table.createdAt)],
)
