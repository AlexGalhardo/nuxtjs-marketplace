import { desc } from 'drizzle-orm'
import { transactionLogQuerySchema } from '#shared/schemas/admin'

// ponytail: one in-memory query capped at exportLimit rows; stream in pages if exports outgrow it.
const exportLimit = 50_000

// GET /api/admin/transaction-logs/export — same filters as the list, as a CSV download (audited).
export default defineEventHandler(async (event) => {
	const admin = await requireAdmin(event)
	const query = await getValidatedQuery(event, transactionLogQuerySchema.parse)
	const rows = await db
		.select()
		.from(schema.transactionLogs)
		.where(transactionLogWhere(query))
		.orderBy(desc(schema.transactionLogs.createdAt), desc(schema.transactionLogs.id))
		.limit(exportLimit)

	const { page: _page, perPage: _perPage, ...filters } = query
	await logAudit({
		actorId: admin.id,
		action: 'transaction_logs.exported',
		targetType: 'transaction_logs',
		metadata: { filters, rows: rows.length },
	})

	setResponseHeaders(event, {
		'content-type': 'text/csv; charset=utf-8',
		'content-disposition': `attachment; filename="transaction-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
		'cache-control': 'no-store',
	})
	return toCsv(
		[
			'created_at',
			'type',
			'status',
			'amount_cents',
			'currency',
			'order_id',
			'seller_order_id',
			'shop_id',
			'user_id',
			'stripe_object_id',
			'id',
			'payload',
		],
		rows.map((row) => [
			row.createdAt,
			row.type,
			row.status,
			row.amountCents,
			row.currency,
			row.orderId,
			row.sellerOrderId,
			row.shopId,
			row.userId,
			row.stripeObjectId,
			row.id,
			JSON.stringify(row.payload),
		]),
	)
})
