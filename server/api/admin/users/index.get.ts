import { and, count, desc, eq } from 'drizzle-orm'
import { adminUsersQuerySchema } from '#shared/schemas/admin'

// GET /api/admin/users — every account, newest first, with its shop if it has one.
export default defineEventHandler(async (event) => {
	await requireAdmin(event)
	const query = await getValidatedQuery(event, adminUsersQuerySchema.parse)
	const where = and(
		searchAny(query.q, [schema.users.name, schema.users.email]),
		query.role ? eq(schema.users.role, query.role) : undefined,
	)
	const [total] = await db.select({ n: count() }).from(schema.users).where(where)
	const data = await db
		.select({
			id: schema.users.id,
			name: schema.users.name,
			email: schema.users.email,
			role: schema.users.role,
			createdAt: schema.users.createdAt,
			shopSlug: schema.shops.slug,
			shopStatus: schema.shops.status,
		})
		.from(schema.users)
		.leftJoin(schema.shops, eq(schema.shops.ownerId, schema.users.id))
		.where(where)
		.orderBy(desc(schema.users.createdAt), desc(schema.users.id))
		.limit(query.perPage)
		.offset((query.page - 1) * query.perPage)
	return { data, meta: pageMeta(query, total?.n) }
})
