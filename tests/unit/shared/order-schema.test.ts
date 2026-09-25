import { describe, expect, it } from 'vitest'
import {
	downloadQuerySchema,
	reviewSchema,
	shipSellerOrderSchema,
} from '../../../shared/schemas/order'

describe('shipSellerOrderSchema', () => {
	it('trims and requires carrier and tracking code', () => {
		expect(shipSellerOrderSchema.parse({ carrier: ' ups ', trackingCode: ' 1Z9 ' })).toEqual({
			carrier: 'ups',
			trackingCode: '1Z9',
		})
		expect(shipSellerOrderSchema.safeParse({ carrier: '  ', trackingCode: '1' }).success).toBe(
			false,
		)
		expect(
			shipSellerOrderSchema.safeParse({ carrier: 'ups', trackingCode: 'x'.repeat(101) })
				.success,
		).toBe(false)
	})
})

describe('reviewSchema', () => {
	it('accepts whole ratings from 1 to 5', () => {
		expect(reviewSchema.safeParse({ orderItemId: 'a', rating: 5 }).success).toBe(true)
		for (const rating of [0, 6, 2.5]) {
			expect(reviewSchema.safeParse({ orderItemId: 'a', rating }).success).toBe(false)
		}
	})

	it('caps the comment length', () => {
		expect(
			reviewSchema.safeParse({ orderItemId: 'a', rating: 3, comment: 'x'.repeat(1001) })
				.success,
		).toBe(false)
	})
})

describe('downloadQuerySchema', () => {
	it('needs a numeric expiry and a 64-char hex signature', () => {
		const signature = 'a'.repeat(64)
		expect(downloadQuerySchema.parse({ expires: '1700000000000', signature })).toEqual({
			expires: 1_700_000_000_000,
			signature,
		})
		expect(downloadQuerySchema.safeParse({ expires: 'soon', signature }).success).toBe(false)
		expect(
			downloadQuerySchema.safeParse({ expires: '1', signature: 'A'.repeat(64) }).success,
		).toBe(false)
		expect(downloadQuerySchema.safeParse({ expires: '1', signature: 'a' }).success).toBe(false)
	})
})
