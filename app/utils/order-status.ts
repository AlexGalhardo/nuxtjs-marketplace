import type { OrderStatus, SellerOrderStatus } from '#shared/types/enums'

type BadgeColor = 'neutral' | 'primary' | 'success' | 'warning' | 'error'

export const orderStatusLabel: Record<OrderStatus, { label: string; color: BadgeColor }> = {
	pending: { label: 'awaiting payment', color: 'warning' },
	paid: { label: 'paid', color: 'success' },
	partially_refunded: { label: 'partly refunded', color: 'neutral' },
	refunded: { label: 'refunded', color: 'neutral' },
	canceled: { label: 'canceled', color: 'neutral' },
	expired: { label: 'expired', color: 'neutral' },
}

export const sellerOrderStatusLabel: Record<
	SellerOrderStatus,
	{ label: string; color: BadgeColor }
> = {
	pending: { label: 'awaiting payment', color: 'warning' },
	paid: { label: 'to ship', color: 'primary' },
	shipped: { label: 'shipped', color: 'success' },
	delivered: { label: 'delivered', color: 'neutral' },
	refunded: { label: 'refunded', color: 'neutral' },
	canceled: { label: 'canceled', color: 'neutral' },
}

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		// Fixed zone so SSR and the browser render the same string (no hydration mismatch).
		timeZone: 'UTC',
	})
}
