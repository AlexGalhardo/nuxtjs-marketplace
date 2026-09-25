// Every admin action lands here (Phase 11, A09). Append-only: never update or delete rows.
export type AuditAction =
	| 'shop.suspended'
	| 'shop.reinstated'
	| 'product.suspended'
	| 'product.reinstated'
	| 'transaction_logs.exported'

export interface AuditEntry {
	actorId: string
	action: AuditAction
	targetType: 'shop' | 'product' | 'transaction_logs'
	targetId?: string | null
	metadata?: Record<string, unknown>
}

// Pass the transaction handle when the entry must commit (or roll back) with the change it records.
export async function logAudit(
	entry: AuditEntry,
	client: Pick<typeof db, 'insert'> = db,
): Promise<void> {
	await client.insert(schema.auditLogs).values({ ...entry, metadata: entry.metadata ?? null })
}
