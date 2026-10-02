import { metrics } from '@opentelemetry/api'
// Every money event lands here (docs/payments-stripe.md). Append-only: never update or delete rows.
export type TransactionType =
	| 'checkout.created'
	| 'checkout.expired'
	| 'payment.succeeded'
	| 'transfer.created'
	| 'transfer.failed'
	| 'dispute.created'
	| 'refund.created'
	| 'refund.failed'
	| 'transfer.reversed'
	| 'transfer.reversal_failed'

export interface TransactionEntry {
	type: TransactionType
	amountCents: number
	status: string
	orderId?: string
	sellerOrderId?: string
	shopId?: string
	userId?: string
	stripeObjectId?: string | null
	payload?: Record<string, unknown>
}

// Pass the transaction handle when the log must commit (or roll back) with the state change.
const meter = metrics.getMeter('resell-sh')
const moneyEvents = meter.createCounter('resell.money_events', {
	description: 'Money events written to transaction_logs, by type and status',
})
const moneyCents = meter.createCounter('resell.money_cents', {
	unit: 'cent',
	description: 'Amount (USD cents) of money events, by type and status',
})

export async function logTransaction(
	entry: TransactionEntry,
	client: Pick<typeof db, 'insert'> = db,
): Promise<void> {
	await client.insert(schema.transactionLogs).values({ ...entry, payload: entry.payload ?? {} })
	// Business metrics come from the same ledger row (no-ops unless telemetry is on, server/plugins/telemetry.ts).
	const labels = { type: entry.type, status: entry.status }
	moneyEvents.add(1, labels)
	if (entry.amountCents) moneyCents.add(entry.amountCents, labels)
}
