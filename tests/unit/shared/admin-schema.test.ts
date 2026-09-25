import { describe, expect, it } from 'vitest'
import {
	adminShopsQuerySchema,
	productModerationSchema,
	shopModerationSchema,
	transactionLogQuerySchema,
} from '../../../shared/schemas/admin'

describe('admin query schemas', () => {
	it('defaults and caps paging', () => {
		expect(adminShopsQuerySchema.parse({})).toMatchObject({ page: 1, perPage: 25 })
		expect(adminShopsQuerySchema.safeParse({ perPage: '101' }).success).toBe(false)
		expect(adminShopsQuerySchema.safeParse({ status: 'deleted' }).success).toBe(false)
	})

	it('accepts an inclusive single-day range and rejects a reversed one', () => {
		expect(
			transactionLogQuerySchema.safeParse({ from: '2026-01-01', to: '2026-01-01' }).success,
		).toBe(true)
		expect(
			transactionLogQuerySchema.safeParse({ from: '2026-02-01', to: '2026-01-01' }).success,
		).toBe(false)
		expect(transactionLogQuerySchema.safeParse({ from: '01/02/2026' }).success).toBe(false)
	})
})

describe('moderation schemas', () => {
	it('requires a reason', () => {
		expect(shopModerationSchema.safeParse({ status: 'suspended', reason: ' ' }).success).toBe(
			false,
		)
		expect(
			shopModerationSchema.safeParse({ status: 'suspended', reason: 'fraud' }).success,
		).toBe(true)
	})

	it('only lets admins suspend or reinstate-as-archived a product', () => {
		expect(
			productModerationSchema.safeParse({ status: 'published', reason: 'ok now' }).success,
		).toBe(false)
		expect(
			productModerationSchema.safeParse({ status: 'archived', reason: 'ok now' }).success,
		).toBe(true)
	})
})
