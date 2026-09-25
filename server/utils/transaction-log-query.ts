import { and, eq, gte, lt, type SQL } from 'drizzle-orm'
import type { TransactionLogQuery } from '#shared/schemas/admin'

const dayMs = 86_400_000

// Shared by the admin list and its CSV export, so the file always matches what's on screen.
export function transactionLogWhere(query: TransactionLogQuery): SQL | undefined {
	const log = schema.transactionLogs
	return and(
		query.type ? eq(log.type, query.type) : undefined,
		query.status ? eq(log.status, query.status) : undefined,
		query.orderId ? eq(log.orderId, query.orderId) : undefined,
		query.shopId ? eq(log.shopId, query.shopId) : undefined,
		query.from ? gte(log.createdAt, new Date(`${query.from}T00:00:00Z`)) : undefined,
		query.to
			? lt(log.createdAt, new Date(Date.parse(`${query.to}T00:00:00Z`) + dayMs))
			: undefined,
	)
}
