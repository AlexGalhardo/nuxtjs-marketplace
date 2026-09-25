import { describe, expect, it } from 'vitest'
import { platformFeeCents, sellerTotals } from '../../../shared/utils/pricing'

describe('platformFeeCents', () => {
	it.each([
		[10_000, 1000, 1000],
		[1999, 1000, 200], // 199.9 rounds half up
		[1994, 1000, 199],
		[5, 1000, 1], // 0.5 rounds up
		[4, 1000, 0],
		[12_345, 0, 0],
		[12_345, 10_000, 12_345],
	])('fee on %i cents at %i bps is %i', (subtotal, bps, fee) => {
		expect(platformFeeCents(subtotal, bps)).toBe(fee)
	})
})

describe('sellerTotals', () => {
	it('charges the fee on items only and pays shipping to the seller', () => {
		const totals = sellerTotals(
			[
				{ priceCents: 2000, shippingCents: 500, quantity: 2 },
				{ priceCents: 999, shippingCents: 0, quantity: 1 },
			],
			1000,
		)
		expect(totals).toEqual({
			subtotalCents: 4999,
			shippingCents: 500,
			feeCents: 500,
			payoutCents: 4999,
		})
	})

	it('applies flat shipping once per line, not per unit', () => {
		expect(
			sellerTotals([{ priceCents: 100, shippingCents: 300, quantity: 5 }], 1000)
				.shippingCents,
		).toBe(300)
	})

	it('always sums payout + fee back to what the buyer paid', () => {
		const lines = [
			{ priceCents: 1234, shippingCents: 99, quantity: 3 },
			{ priceCents: 1, shippingCents: 0, quantity: 7 },
		]
		const totals = sellerTotals(lines, 1234)
		expect(totals.payoutCents + totals.feeCents).toBe(
			totals.subtotalCents + totals.shippingCents,
		)
	})
})
