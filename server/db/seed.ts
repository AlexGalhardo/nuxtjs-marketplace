// Default seed (docs/database.md). Always: the fixed product types (D13). Outside production also a
// fake catalog for layout/testing: 100 users, one shop each, 5–20 products per shop with
// placeholder photos (picsum.photos). Idempotent: faker runs from a fixed seed and the whole
// dataset is generated in memory *before* any write, so reruns rebuild the exact same rows and
// `onConflictDoNothing()` skips them. Every fake account logs in with FAKE_PASSWORD.
//
// Patterns (requested by the owner for this seed): SeedDatabase is a Singleton (one DB client per
// run), each entity has a Factory (make/makeMany over faker), CatalogSeeder orchestrates them.
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import type { ProductKind, ProductStatus } from '../../shared/types/enums'
import { slugify } from '../../shared/utils/slug'
import { closeSeedClient, createSeedClient } from './client'

const FAKER_SEED = 2026
const FAKE_USERS = 100
const PRODUCTS_PER_SHOP = { min: 5, max: 20 }
const FAKE_PASSWORD = 'Demo123!'
const FAKE_EMAIL_DOMAIN = 'demo.resell.sh'

// Fixed list (D13, PLAN.md §3.4): filters stay clean because every product picks one of these.
const productTypes = [
	{ slug: 'electronics', name: 'Electronics', kind: 'physical' as const },
	{ slug: 'clothing-apparel', name: 'Clothing & Apparel', kind: 'physical' as const },
	{ slug: 'home-kitchen', name: 'Home & Kitchen', kind: 'physical' as const },
	{ slug: 'books', name: 'Books', kind: 'physical' as const },
	{ slug: 'toys-games', name: 'Toys & Games', kind: 'physical' as const },
	{ slug: 'sports-outdoors', name: 'Sports & Outdoors', kind: 'physical' as const },
	{ slug: 'ebooks', name: 'E-books', kind: 'digital' as const },
	{ slug: 'software-apps', name: 'Software & Apps', kind: 'digital' as const },
	{ slug: 'online-courses', name: 'Online Courses', kind: 'digital' as const },
	{ slug: 'digital-art-design', name: 'Digital Art & Design', kind: 'digital' as const },
	{ slug: 'music-audio', name: 'Music & Audio', kind: 'digital' as const },
	{ slug: 'templates-themes', name: 'Templates & Themes', kind: 'digital' as const },
]

type SeedClient = Awaited<ReturnType<typeof createSeedClient>>

/** Singleton: one Drizzle client for the whole run, closed once at the end. */
class SeedDatabase {
	private static instance: SeedDatabase | undefined
	private client: Promise<SeedClient> | undefined

	private constructor() {}

	static getInstance(): SeedDatabase {
		SeedDatabase.instance ??= new SeedDatabase()
		return SeedDatabase.instance
	}

	connect(): Promise<SeedClient> {
		this.client ??= createSeedClient()
		return this.client
	}

	async close() {
		if (!this.client) return
		await closeSeedClient((await this.client).db)
		this.client = undefined
	}
}

/** Factory base: `make` builds one plain record from faker, `makeMany` a list. */
abstract class Factory<T, Context> {
	abstract make(context: Context): T

	makeMany(count: number, context: Context): T[] {
		return Array.from({ length: count }, () => this.make(context))
	}
}

type FakeUser = { email: string; name: string }
type FakeShop = {
	slug: string
	name: string
	description: string
	logoPath: string
	bannerPath: string
	chargesEnabled: boolean
}
type FakeProduct = {
	typeSlug: string
	kind: ProductKind
	title: string
	slug: string
	description: string
	priceCents: number
	shippingCents: number
	stock: number | null
	status: ProductStatus
	createdAt: Date
	images: string[]
}

const picsum = (width: number, height: number) =>
	faker.image.urlPicsumPhotos({ width, height, grayscale: false, blur: 0 })

class UserFactory extends Factory<FakeUser, { index: number }> {
	make({ index }: { index: number }): FakeUser {
		const firstName = faker.person.firstName()
		const lastName = faker.person.lastName()
		return {
			name: `${firstName} ${lastName}`.slice(0, 24),
			email: `${slugify(`${firstName}.${lastName}`)}.${index}@${FAKE_EMAIL_DOMAIN}`,
		}
	}
}

class ShopFactory extends Factory<FakeShop, { owner: FakeUser; index: number }> {
	make({ owner, index }: { owner: FakeUser; index: number }): FakeShop {
		const handle = faker.helpers
			.arrayElement([
				`${owner.name.split(' ')[0]}'s ${faker.helpers.arrayElement(['closet', 'corner', 'garage', 'drop', 'stash', 'lab'])}`,
				`${faker.word.adjective()} ${faker.word.noun()}`,
				`${faker.company.buzzNoun()} ${faker.helpers.arrayElement(['store', 'goods', 'supply', 'studio'])}`,
			])
			.toLowerCase()
		return {
			name: handle.slice(0, 40),
			slug: `${slugify(handle).slice(0, 40)}-${index}`,
			description: faker.company.catchPhrase().toLowerCase(),
			logoPath: picsum(256, 256),
			bannerPath: picsum(1200, 300),
			chargesEnabled: faker.datatype.boolean({ probability: 0.9 }),
		}
	}
}

// Digital goods have no faker helper that reads right; these keep titles believable per type.
const digitalNouns: Record<string, string[]> = {
	ebooks: ['e-book', 'field guide', 'zine', 'workbook'],
	'software-apps': ['menubar app', 'browser extension', 'cli tool', 'plugin'],
	'online-courses': ['video course', 'crash course', 'workshop recording', 'masterclass'],
	'digital-art-design': ['preset pack', 'icon set', 'brush pack', 'texture pack'],
	'music-audio': ['sample pack', 'drum kit', 'lo-fi loops', 'sound effects pack'],
	'templates-themes': ['notion template', 'figma ui kit', 'resume template', 'website theme'],
}

class ProductFactory extends Factory<FakeProduct, { types: typeof productTypes }> {
	make({ types }: { types: typeof productTypes }): FakeProduct {
		const type = faker.helpers.arrayElement(types)
		const digital = type.kind === 'digital'
		const title = (
			digital
				? `${faker.word.adjective()} ${faker.helpers.arrayElement(digitalNouns[type.slug] ?? ['download'])}`
				: faker.commerce.productName()
		).toLowerCase()
		return {
			typeSlug: type.slug,
			kind: type.kind,
			title,
			slug: `${slugify(title)}-${faker.string.alphanumeric({ length: 6, casing: 'lower' })}`,
			description: faker.commerce.productDescription().toLowerCase(),
			priceCents:
				faker.number.int({ min: digital ? 3 : 5, max: digital ? 60 : 180 }) * 100 +
				faker.helpers.arrayElement([0, 0, 50, 90, 99]),
			shippingCents: digital ? 0 : faker.number.int({ min: 3, max: 15 }) * 100,
			stock: digital
				? null
				: faker.helpers.weightedArrayElement([
						{ weight: 1, value: 0 },
						{ weight: 9, value: faker.number.int({ min: 1, max: 5 }) },
					]),
			status: faker.helpers.weightedArrayElement<ProductStatus>([
				{ weight: 17, value: 'published' },
				{ weight: 2, value: 'draft' },
				{ weight: 1, value: 'archived' },
			]),
			createdAt: faker.date.recent({ days: 60 }),
			// Some digital products stay photo-less on purpose: exercises the typographic fallback tile.
			images:
				digital && faker.datatype.boolean({ probability: 0.4 })
					? []
					: Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () =>
							picsum(800, 800),
						),
		}
	}
}

/** Orchestrates the factories: generate everything first (deterministic), then persist. */
class CatalogSeeder {
	private readonly users = new UserFactory()
	private readonly shops = new ShopFactory()
	private readonly products = new ProductFactory()

	plan() {
		faker.seed(FAKER_SEED)
		return Array.from({ length: FAKE_USERS }, (_, index) => {
			const owner = this.users.make({ index: index + 1 })
			const shop = this.shops.make({ owner, index: index + 1 })
			const count = faker.number.int(PRODUCTS_PER_SHOP)
			return { owner, shop, products: this.products.makeMany(count, { types: productTypes }) }
		})
	}

	async run() {
		const { db, schema } = await SeedDatabase.getInstance().connect()
		const plan = this.plan()
		const types = new Map(
			(await db.select().from(schema.productTypes)).map(
				(type: { slug: string; id: string }) => [type.slug, type.id],
			),
		)
		// Same scrypt driver nuxt-auth-utils uses (its password.js); hashed once, shared by all fakes.
		const passwordHash = await new Hash(new Scrypt({})).make(FAKE_PASSWORD)

		let newProducts = 0
		for (const { owner, shop, products } of plan) {
			await db
				.insert(schema.users)
				.values({ ...owner, passwordHash })
				.onConflictDoNothing()
			const [user] = await db
				.select({ id: schema.users.id })
				.from(schema.users)
				.where(eq(schema.users.email, owner.email))
			if (!user) continue

			await db
				.insert(schema.shops)
				.values({ ...shop, ownerId: user.id, payoutsEnabled: shop.chargesEnabled })
				.onConflictDoNothing()
			const [shopRow] = await db
				.select({ id: schema.shops.id })
				.from(schema.shops)
				.where(eq(schema.shops.ownerId, user.id))
			if (!shopRow) continue

			const inserted = await db
				.insert(schema.products)
				.values(
					products.map(({ images: _images, typeSlug, ...product }) => ({
						...product,
						shopId: shopRow.id,
						productTypeId: types.get(typeSlug) ?? '',
						updatedAt: product.createdAt,
					})),
				)
				.onConflictDoNothing()
				.returning({ id: schema.products.id, slug: schema.products.slug })
			newProducts += inserted.length

			const imagesBySlug = new Map(products.map((product) => [product.slug, product.images]))
			const imageRows = inserted.flatMap((row: { id: string; slug: string }) =>
				(imagesBySlug.get(row.slug) ?? []).map((blobPath, position) => ({
					productId: row.id,
					blobPath,
					position,
				})),
			)
			if (imageRows.length) await db.insert(schema.productImages).values(imageRows)
		}
		const total = plan.reduce((sum, entry) => sum + entry.products.length, 0)
		console.log(
			`Fake catalog: ${plan.length} users/shops, ${total} products (${newProducts} new). Password: ${FAKE_PASSWORD}`,
		)
	}
}

async function main() {
	const { db, dialect, schema } = await SeedDatabase.getInstance().connect()
	console.log(`Seeding ${dialect} database...`)
	for (const productType of productTypes) {
		await db.insert(schema.productTypes).values(productType).onConflictDoNothing()
	}
	console.log(`Seeded ${productTypes.length} product types.`)

	if (process.env.NODE_ENV === 'production') {
		console.log(
			'Production: skipping the fake catalog (PRODUCT.md: fake data never passes as real).',
		)
	} else {
		await new CatalogSeeder().run()
	}
	await SeedDatabase.getInstance().close()
}

main().catch((error: unknown) => {
	console.error(error)
	process.exit(1)
})
