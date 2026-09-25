import { count, desc } from 'drizzle-orm'
import { transactionLogQuerySchema } from '#shared/schemas/admin'

// GET /api/admin/transaction-logs — the append-only money ledger, newest first, filterable.
// `types` lists every type seen so far, for the filter menu.
export default defineEventHandler(async (event) => {
	await requireAdmin(event)
	const query = await getValidatedQuery(event, transactionLogQuerySchema.parse)
	const where = transactionLogWhere(query)
	const [[total], data, types] = await Promise.all([
		db.select({ n: count() }).from(schema.transactionLogs).where(where),
		db
			.select()
			.from(schema.transactionLogs)
			.where(where)
			.orderBy(desc(schema.transactionLogs.createdAt), desc(schema.transactionLogs.id))
			.limit(query.perPage)
			.offset((query.page - 1) * query.perPage),
		db
			.selectDistinct({ type: schema.transactionLogs.type })
			.from(schema.transactionLogs)
			.orderBy(schema.transactionLogs.type),
	])
	return { data, types: types.map((row) => row.type), meta: pageMeta(query, total?.n) }
})
