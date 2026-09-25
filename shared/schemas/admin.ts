import { z } from 'zod'

// Phase 11: /api/admin/** query strings and moderation bodies.
const page = z.coerce.number().int().min(1).default(1)
const perPage = z.coerce.number().int().min(1).max(100).default(25)
const q = z.string().trim().max(100).optional()

export const adminUsersQuerySchema = z.object({
	q,
	role: z.enum(['user', 'admin']).optional(),
	page,
	perPage,
})

export const adminShopsQuerySchema = z.object({
	q,
	status: z.enum(['active', 'suspended']).optional(),
	page,
	perPage,
})

export const adminProductsQuerySchema = z.object({
	q,
	status: z.enum(['draft', 'published', 'archived', 'suspended']).optional(),
	page,
	perPage,
})

// YYYY-MM-DD, interpreted in UTC; `to` is inclusive (the whole day).
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')

export const transactionLogQuerySchema = z
	.object({
		type: z.string().trim().max(40).optional(),
		status: z.string().trim().max(40).optional(),
		orderId: z.string().trim().max(40).optional(),
		shopId: z.string().trim().max(40).optional(),
		from: day.optional(),
		to: day.optional(),
		page,
		perPage,
	})
	.refine((query) => !query.from || !query.to || query.from <= query.to, {
		message: '“from” must be on or before “to”',
		path: ['from'],
	})

export type TransactionLogQuery = z.infer<typeof transactionLogQuerySchema>

// Reason is required: it's what the audit log (and the seller, later) sees.
const reason = z.string().trim().min(3, 'Say why').max(500)

export const shopModerationSchema = z.object({
	status: z.enum(['active', 'suspended']),
	reason,
})

// Reinstating a product sends it back to `archived`; the seller decides when to republish.
export const productModerationSchema = z.object({
	status: z.enum(['suspended', 'archived']),
	reason,
})

export type ShopModerationInput = z.input<typeof shopModerationSchema>
export type ProductModerationInput = z.input<typeof productModerationSchema>
