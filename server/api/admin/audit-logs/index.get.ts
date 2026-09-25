import { count, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

const querySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	perPage: z.coerce.number().int().min(1).max(100).default(20),
})

// GET /api/admin/audit-logs — what admins did, newest first, with the acting admin's name.
export default defineEventHandler(async (event) => {
	await requireAdmin(event)
	const query = await getValidatedQuery(event, querySchema.parse)
	const [[total], data] = await Promise.all([
		db.select({ n: count() }).from(schema.auditLogs),
		db
			.select({
				id: schema.auditLogs.id,
				action: schema.auditLogs.action,
				targetType: schema.auditLogs.targetType,
				targetId: schema.auditLogs.targetId,
				metadata: schema.auditLogs.metadata,
				createdAt: schema.auditLogs.createdAt,
				actorName: schema.users.name,
			})
			.from(schema.auditLogs)
			.leftJoin(schema.users, eq(schema.auditLogs.actorId, schema.users.id))
			.orderBy(desc(schema.auditLogs.createdAt), desc(schema.auditLogs.id))
			.limit(query.perPage)
			.offset((query.page - 1) * query.perPage),
	])
	return { data, meta: pageMeta(query, total?.n) }
})
