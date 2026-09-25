import { asc, eq } from 'drizzle-orm'
import type { Cart, CartGroup, CartLine } from '#shared/types/cart'

// The buyer's cart, re-validated against the live catalog on every read: price, stock and
// visibility always come from `products`/`shops`, never from what the client last saw (A06).
export async function loadCart(userId: string): Promise<Cart> {
	const rows = await db
		.select({
			productId: schema.products.id,
			slug: schema.products.slug,
			title: schema.products.title,
			kind: schema.products.kind,
			priceCents: schema.products.priceCents,
			shippingCents: schema.products.shippingCents,
			stock: schema.products.stock,
			status: schema.products.status,
			quantity: schema.cartItems.quantity,
			shopId: schema.shops.id,
			shopSlug: schema.shops.slug,
			shopName: schema.shops.name,
			shopStatus: schema.shops.status,
			chargesEnabled: schema.shops.chargesEnabled,
		})
		.from(schema.cartItems)
		.innerJoin(schema.products, eq(schema.cartItems.productId, schema.products.id))
		.innerJoin(schema.shops, eq(schema.products.shopId, schema.shops.id))
		.where(eq(schema.cartItems.userId, userId))
		.orderBy(asc(schema.cartItems.createdAt))

	const covers = await coverImages(rows.map((row) => row.productId))
	const groups = new Map<string, CartGroup>()
	for (const { status, shopStatus, chargesEnabled, ...row } of rows) {
		const line: CartLine = {
			...row,
			coverPath: covers.get(row.productId) ?? null,
			problem: lineProblem(
				row,
				status === 'published' && shopStatus === 'active' && chargesEnabled,
			),
		}
		const group = groups.get(row.shopId) ?? {
			shopId: row.shopId,
			shopSlug: row.shopSlug,
			shopName: row.shopName,
			lines: [],
			subtotalCents: 0,
			shippingCents: 0,
		}
		group.lines.push(line)
		group.subtotalCents += line.priceCents * line.quantity
		group.shippingCents += line.shippingCents
		groups.set(row.shopId, group)
	}

	const shopGroups = [...groups.values()]
	const lines = shopGroups.flatMap((group) => group.lines)
	const subtotalCents = shopGroups.reduce((sum, group) => sum + group.subtotalCents, 0)
	const shippingCents = shopGroups.reduce((sum, group) => sum + group.shippingCents, 0)
	return {
		groups: shopGroups,
		count: lines.reduce((sum, line) => sum + line.quantity, 0),
		subtotalCents,
		shippingCents,
		totalCents: subtotalCents + shippingCents,
		hasPhysical: lines.some((line) => line.kind === 'physical'),
		canCheckout: lines.length > 0 && lines.every((line) => !line.problem),
	}
}

function lineProblem(
	line: { kind: string; stock: number | null; quantity: number },
	visible: boolean,
): CartLine['problem'] {
	if (!visible) return 'unavailable'
	if (line.kind !== 'physical' || line.stock === null) return null
	if (line.stock === 0) return 'out_of_stock'
	return line.stock < line.quantity ? 'not_enough_stock' : null
}

// 409 when a physical product can't cover the requested quantity (null stock = unlimited).
export function assertStock(
	product: { kind: string; stock: number | null },
	quantity: number,
): void {
	if (product.kind !== 'physical' || product.stock === null || product.stock >= quantity) return
	throw createError({
		statusCode: 409,
		statusMessage: product.stock === 0 ? 'Sold out' : `Only ${product.stock} left in stock`,
	})
}
