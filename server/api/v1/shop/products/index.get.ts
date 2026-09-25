import { count, eq } from 'drizzle-orm'
import { z } from 'zod'

defineRouteMeta({
	openAPI: {
		tags: ['products'],
		summary: 'List your products',
		description: 'Paginated with `page` and `perPage` (≤ 100).',
	},
})

const querySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const { page, perPage } = await getValidatedQuery(event, querySchema.parse)

	const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, user.id))
	if (!shop) {
		return { data: [], meta: { page, perPage, total: 0 } }
	}

	const totalRows = await db
		.select({ total: count() })
		.from(schema.products)
		.where(eq(schema.products.shopId, shop.id))
	const total = totalRows[0]?.total ?? 0

	const data = await db
		.select()
		.from(schema.products)
		.where(eq(schema.products.shopId, shop.id))
		.orderBy(schema.products.createdAt)
		.limit(perPage)
		.offset((page - 1) * perPage)

	return { data, meta: { page, perPage, total } }
})
