// Load seed (PLAN.md Phase 18): a marketplace at "black friday" size for the QA suite (tests/qa) and the
// load test (tests/load/black-friday.ts). 1,000 sellers (charges-enabled shop, published products of every
// type), 10,000 buyers (one address each), carts, paid orders with their ledger rows, and reviews.
// Deterministic (fixed faker seed), batched inserts in one transaction (all or nothing), both dialects.
// Idempotent: skips when the admin marker row exists. Needs the product types (`bun run db:seed`) first.
// Every account logs in with LOAD_PASSWORD.
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { newId } from '../../shared/utils/id'
import { sellerTotals } from '../../shared/utils/pricing'
import { closeSeedClient, createSeedClient } from './client'

export const LOAD_PASSWORD = 'Load123!'
export const LOAD_DOMAIN = 'load.resell.sh'
export const LOAD_ADMIN_EMAIL = `admin@${LOAD_DOMAIN}`
export const loadSellerEmail = (index: number): string => `seller.${index}@${LOAD_DOMAIN}`
export const loadBuyerEmail = (index: number): string => `buyer.${index}@${LOAD_DOMAIN}`
// Buyers 1..CART_BUYERS have a cart; ORDER_BUYERS more after them have one paid order each; the rest are
// fresh, so tests and the load test can claim buyers that start with an empty cart and no orders.
export const LOAD_SIZES = { sellers: 1_000, buyers: 10_000, cartBuyers: 2_000, orderBuyers: 3_000 }

const FAKER_SEED = 1811
const PLATFORM_FEE_BPS = 1000
const PHOTOS_PER_TYPE = 5

type Row = Record<string, unknown>

function plan(types: { id: string; slug: string; kind: 'physical' | 'digital' }[], hash: string) {
	faker.seed(FAKER_SEED)
	const now = Date.now()
	const day = 86_400_000
	const users: Row[] = []
	const shops: Row[] = []
	const products: (Row & { id: string; shopId: string; ownerIndex: number })[] = []
	const images: Row[] = []
	const addresses: Row[] = []

	for (let index = 1; index <= LOAD_SIZES.sellers; index++) {
		const userId = newId()
		users.push({
			id: userId,
			email: loadSellerEmail(index),
			name: faker.person.fullName().slice(0, 24),
			passwordHash: hash,
		})
		const shopId = newId()
		shops.push({
			id: shopId,
			ownerId: userId,
			slug: `load-shop-${index}`,
			name: `${faker.word.adjective()} ${faker.word.noun()} ${index}`
				.toLowerCase()
				.slice(0, 60),
			description: faker.company.catchPhrase().toLowerCase(),
			// Fake Stripe accepts any destination but `acct_fail` (tests/integration/helpers/fake-stripe.ts).
			stripeAccountId: `acct_load_${index}`,
			chargesEnabled: true,
			payoutsEnabled: true,
		})
		const count = faker.number.int({ min: 3, max: 6 })
		for (let item = 0; item < count; item++) {
			const type = types[(products.length + index) % types.length]
			if (!type) continue
			const digital = type.kind === 'digital'
			const id = newId()
			const createdAt = new Date(now - faker.number.int({ min: 0, max: 90 }) * day)
			const title =
				`${faker.commerce.productAdjective()} ${faker.commerce.product()}`.toLowerCase()
			products.push({
				id,
				shopId,
				ownerIndex: index,
				productTypeId: type.id,
				kind: type.kind,
				title,
				slug: `load-${index}-${item}-${title.replace(/[^a-z0-9]+/g, '-')}`,
				description: faker.commerce.productDescription().toLowerCase(),
				priceCents:
					faker.number.int({ min: 3, max: 250 }) * 100 +
					faker.helpers.arrayElement([0, 50, 99]),
				shippingCents: digital ? 0 : faker.number.int({ min: 0, max: 15 }) * 100,
				stock: digital
					? null
					: faker.helpers.weightedArrayElement([
							{ weight: 1, value: 0 },
							{ weight: 19, value: faker.number.int({ min: 50, max: 500 }) },
						]),
				status: faker.helpers.weightedArrayElement([
					{ weight: 18, value: 'published' },
					{ weight: 1, value: 'draft' },
					{ weight: 1, value: 'archived' },
				]),
				createdAt,
				updatedAt: createdAt,
			})
			images.push({
				productId: id,
				blobPath: `seed/products/${type.slug}/${faker.number.int({ min: 1, max: PHOTOS_PER_TYPE })}.webp`,
				position: 0,
			})
		}
	}

	for (let index = 1; index <= LOAD_SIZES.buyers; index++) {
		const userId = newId()
		users.push({
			id: userId,
			email: loadBuyerEmail(index),
			name: faker.person.fullName().slice(0, 24),
			passwordHash: hash,
		})
		addresses.push({
			userId,
			fullName: faker.person.fullName().slice(0, 100),
			line1: faker.location.streetAddress(),
			city: faker.location.city(),
			state: faker.location.state({ abbreviated: true }),
			postalCode: faker.location.zipCode('#####'),
			country: 'US',
			phone: faker.phone.number({ style: 'national' }).slice(0, 30),
			isDefault: true,
		})
	}
	users.push({ email: LOAD_ADMIN_EMAIL, name: 'load admin', passwordHash: hash, role: 'admin' })

	const buyable = products.filter(
		(product) => product.status === 'published' && product.stock !== 0,
	)
	const buyerId = (index: number) => users[LOAD_SIZES.sellers + index - 1]?.id as string

	const cartItems: Row[] = []
	for (let index = 1; index <= LOAD_SIZES.cartBuyers; index++) {
		for (const product of faker.helpers.arrayElements(buyable, { min: 1, max: 3 })) {
			cartItems.push({ userId: buyerId(index), productId: product.id, quantity: 1 })
		}
	}

	const byShop = new Map<string, typeof buyable>()
	for (const product of buyable)
		byShop.set(product.shopId, [...(byShop.get(product.shopId) ?? []), product])
	const orders: Row[] = []
	const sellerOrders: Row[] = []
	const orderItems: Row[] = []
	const logs: Row[] = []
	const reviews: Row[] = []
	const ratings = new Map<string, number[]>()
	for (let offset = 1; offset <= LOAD_SIZES.orderBuyers; offset++) {
		const buyer = buyerId(LOAD_SIZES.cartBuyers + offset)
		const shopProducts = byShop.get(faker.helpers.arrayElement([...byShop.keys()])) ?? []
		const lines = faker.helpers
			.arrayElements(shopProducts, { min: 1, max: 2 })
			.map((product) => ({
				product,
				quantity: product.kind === 'digital' ? 1 : faker.number.int({ min: 1, max: 2 }),
			}))
		const totals = sellerTotals(
			lines.map(({ product, quantity }) => ({
				priceCents: product.priceCents as number,
				shippingCents: product.shippingCents as number,
				quantity,
			})),
			PLATFORM_FEE_BPS,
		)
		const createdAt = new Date(now - faker.number.int({ min: 1, max: 60 }) * day)
		const orderId = newId()
		const sellerOrderId = newId()
		const paymentIntent = `pi_load_${offset}`
		const totalCents = totals.subtotalCents + totals.shippingCents
		const status = faker.helpers.arrayElement(['paid', 'shipped', 'delivered'])
		orders.push({
			id: orderId,
			buyerId: buyer,
			status: 'paid',
			subtotalCents: totals.subtotalCents,
			shippingCents: totals.shippingCents,
			feeCents: totals.feeCents,
			totalCents,
			stripeCheckoutSessionId: `cs_load_${offset}`,
			stripePaymentIntentId: paymentIntent,
			createdAt,
			updatedAt: createdAt,
		})
		const shopId = lines[0]?.product.shopId as string
		sellerOrders.push({
			id: sellerOrderId,
			orderId,
			shopId,
			status,
			...totals,
			stripeTransferId: `tr_load_${offset}`,
			createdAt,
			updatedAt: createdAt,
		})
		for (const { product, quantity } of lines) {
			const orderItemId = newId()
			orderItems.push({
				id: orderItemId,
				sellerOrderId,
				productId: product.id,
				title: product.title,
				priceCents: product.priceCents,
				quantity,
				kind: product.kind,
				createdAt,
			})
			if (faker.datatype.boolean({ probability: 0.5 })) {
				const rating = faker.number.int({ min: 1, max: 5 })
				reviews.push({
					productId: product.id,
					buyerId: buyer,
					orderItemId,
					rating,
					comment: faker.lorem.sentence().toLowerCase(),
					createdAt,
					updatedAt: createdAt,
				})
				ratings.set(product.id, [...(ratings.get(product.id) ?? []), rating])
			}
		}
		// The ledger the app writes for a paid order: payment in, payout out (fee = the difference).
		logs.push(
			{
				type: 'payment.succeeded',
				orderId,
				userId: buyer,
				stripeObjectId: `ch_load_${offset}`,
				amountCents: totalCents,
				status: 'succeeded',
				payload: { paymentIntentId: paymentIntent },
				createdAt,
			},
			{
				type: 'transfer.created',
				orderId,
				sellerOrderId,
				shopId,
				stripeObjectId: `tr_load_${offset}`,
				amountCents: totals.payoutCents,
				status: 'succeeded',
				payload: {},
				createdAt,
			},
		)
	}
	for (const product of products) {
		const scores = ratings.get(product.id)
		if (!scores) continue
		product.ratingCount = scores.length
		product.ratingAvg = scores.reduce((sum, score) => sum + score, 0) / scores.length
	}

	return {
		users,
		shops,
		products: products.map(({ ownerIndex: _ownerIndex, ...product }) => product),
		images,
		addresses,
		cartItems,
		orders,
		sellerOrders,
		orderItems,
		logs,
		reviews,
	}
}

async function main(): Promise<void> {
	const { db, dialect, schema } = await createSeedClient()
	const [marker] = await db
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(eq(schema.users.email, LOAD_ADMIN_EMAIL))
	if (marker) {
		console.log(`Load seed already in this ${dialect} database: skipped.`)
		return closeSeedClient(db)
	}
	const types = await db.select().from(schema.productTypes)
	if (!types.length) throw new Error('No product types: run `bun run db:seed` first.')

	const started = Date.now()
	// One scrypt hash shared by every account: hashing 11,000 passwords would take minutes.
	const hash = await new Hash(new Scrypt({})).make(LOAD_PASSWORD)
	const data = plan(types, hash)
	const tables = [
		['users', schema.users, data.users],
		['shops', schema.shops, data.shops],
		['products', schema.products, data.products],
		['product_images', schema.productImages, data.images],
		['addresses', schema.addresses, data.addresses],
		['cart_items', schema.cartItems, data.cartItems],
		['orders', schema.orders, data.orders],
		['seller_orders', schema.sellerOrders, data.sellerOrders],
		['order_items', schema.orderItems, data.orderItems],
		['reviews', schema.reviews, data.reviews],
		['transaction_logs', schema.transactionLogs, data.logs],
	] as const
	// Bound parameters per statement stay under SQLite's 32,766 (and Postgres' 65,535) limit.
	await db.transaction(async (tx: typeof db) => {
		for (const [, table, rows] of tables) {
			const columns = Object.keys(table).length
			const size = Math.max(1, Math.floor(30_000 / columns))
			for (let start = 0; start < rows.length; start += size) {
				await tx.insert(table).values(rows.slice(start, start + size) as never)
			}
		}
	})
	const counts = tables.map(([name, , rows]) => `${rows.length} ${name}`).join(', ')
	console.log(
		`Load seed (${dialect}) in ${((Date.now() - started) / 1000).toFixed(1)}s: ${counts}. Password: ${LOAD_PASSWORD}`,
	)
	await closeSeedClient(db)
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('server/db/seed-load.ts')) {
	main().catch((error: unknown) => {
		console.error(error)
		process.exit(1)
	})
}
