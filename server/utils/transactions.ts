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
export async function logTransaction(
	entry: TransactionEntry,
	client: Pick<typeof db, 'insert'> = db,
): Promise<void> {
	await client.insert(schema.transactionLogs).values({ ...entry, payload: entry.payload ?? {} })
}
