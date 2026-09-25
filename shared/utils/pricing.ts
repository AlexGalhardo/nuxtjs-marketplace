// Money math for checkout (D3, D4, D11). Integer cents in, integer cents out.

export interface PricedLine {
	priceCents: number
	shippingCents: number
	quantity: number
}

export interface SellerTotals {
	subtotalCents: number
	shippingCents: number
	feeCents: number
	payoutCents: number
}

// Fee applies to the item subtotal only, never to shipping (D3). Rounded half up to the cent.
export function platformFeeCents(subtotalCents: number, feeBps: number): number {
	return Math.round((subtotalCents * feeBps) / 10_000)
}

// D11: shipping is the seller's flat rate per product line (not per unit); digital lines carry 0.
export function sellerTotals(lines: PricedLine[], feeBps: number): SellerTotals {
	const subtotalCents = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0)
	const shippingCents = lines.reduce((sum, line) => sum + line.shippingCents, 0)
	const feeCents = platformFeeCents(subtotalCents, feeBps)
	return {
		subtotalCents,
		shippingCents,
		feeCents,
		payoutCents: subtotalCents + shippingCents - feeCents,
	}
}
