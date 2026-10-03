import {
	checkout,
	dbQuery,
	expect,
	listProduct,
	makeBuyer,
	makeSeller,
	ok,
	pay,
	sellerOrderOf,
	test,
} from './helpers'

// Transactions and consistency: the ledger (transaction_logs) and the order rows must always agree, and an
// injected Stripe failure must leave no half-written state behind.

interface Ledger {
	order: { status: string; totalCents: number; feeCents: number }
	sellers: {
		id: string
		status: string
		payoutCents: number
		feeCents: number
		stripeTransferId: string | null
	}[]
	logs: { type: string; amountCents: number; sellerOrderId: string | null; status: string }[]
}

function ledger(orderId: string): Ledger {
	return dbQuery<Ledger>(`
    const id = ${JSON.stringify(orderId)}
    const [order] = await db.select({ status: schema.orders.status, totalCents: schema.orders.totalCents, feeCents: schema.orders.feeCents }).from(schema.orders).where(eq(schema.orders.id, id))
    const sellers = await db.select({ id: schema.sellerOrders.id, status: schema.sellerOrders.status, payoutCents: schema.sellerOrders.payoutCents, feeCents: schema.sellerOrders.feeCents, stripeTransferId: schema.sellerOrders.stripeTransferId }).from(schema.sellerOrders).where(eq(schema.sellerOrders.orderId, id))
    const logs = await db.select({ type: schema.transactionLogs.type, amountCents: schema.transactionLogs.amountCents, sellerOrderId: schema.transactionLogs.sellerOrderId, status: schema.transactionLogs.status }).from(schema.transactionLogs).where(eq(schema.transactionLogs.orderId, id))
    return { order, sellers, logs }
  `)
}

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0)

test('a two-seller checkout: payouts + platform fee == amount paid, every money event logged', async ({
	playwright,
}) => {
	const alice = await makeSeller(playwright)
	const bob = await makeSeller(playwright)
	const jacket = await listProduct(alice, 'physical', {
		priceCents: 3333,
		shippingCents: 499,
		stock: 4,
	})
	const preset = await listProduct(alice, 'digital', { priceCents: 1001 })
	const lamp = await listProduct(bob, 'physical', {
		priceCents: 7777,
		shippingCents: 0,
		stock: 2,
	})
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[jacket.id, 3], [preset.id], [lamp.id]])
	await pay(buyer.api, orderId)

	const { order, sellers, logs } = ledger(orderId)
	expect(order.status).toBe('paid')
	expect(order.totalCents).toBe(3333 * 3 + 499 + 1001 + 7777)
	expect(sum(sellers.map((seller) => seller.payoutCents)) + order.feeCents).toBe(order.totalCents)
	expect(sum(sellers.map((seller) => seller.feeCents))).toBe(order.feeCents)

	const of = (type: string) => logs.filter((log) => log.type === type)
	expect(of('checkout.created').map((log) => log.amountCents)).toEqual([order.totalCents])
	expect(of('payment.succeeded').map((log) => log.amountCents)).toEqual([order.totalCents])
	const transfers = of('transfer.created')
	expect(transfers).toHaveLength(2)
	for (const seller of sellers) {
		expect(transfers.find((log) => log.sellerOrderId === seller.id)?.amountCents).toBe(
			seller.payoutCents,
		)
		expect(seller.stripeTransferId).toBeTruthy()
	}
	expect(sum(transfers.map((log) => log.amountCents)) + order.feeCents).toBe(
		sum(of('payment.succeeded').map((log) => log.amountCents)),
	)
})

test('ledger invariants hold for every paid order in the database (seeded and test-made)', () => {
	const result = dbQuery<{ count: number; broken: string[] }>(
		`
    const orders = await db.select().from(schema.orders).where(inArray(schema.orders.status, ['paid', 'partially_refunded', 'refunded']))
    const sellers = await db.select().from(schema.sellerOrders)
    const logs = await db.select({ orderId: schema.transactionLogs.orderId, type: schema.transactionLogs.type, amountCents: schema.transactionLogs.amountCents }).from(schema.transactionLogs)
    const byOrder = new Map()
    for (const seller of sellers) byOrder.set(seller.orderId, [...(byOrder.get(seller.orderId) ?? []), seller])
    const paid = new Map()
    for (const log of logs) if (log.type === 'payment.succeeded') paid.set(log.orderId, [...(paid.get(log.orderId) ?? []), log.amountCents])
    const broken = []
    for (const order of orders) {
      const parts = byOrder.get(order.id) ?? []
      const payouts = parts.reduce((total, part) => total + part.payoutCents, 0)
      const fees = parts.reduce((total, part) => total + part.feeCents, 0)
      const subtotal = parts.reduce((total, part) => total + part.subtotalCents + part.shippingCents, 0)
      if (payouts + order.feeCents !== order.totalCents) broken.push(order.id + ': payouts + fee != total')
      if (fees !== order.feeCents || subtotal !== order.totalCents) broken.push(order.id + ': seller parts != order')
      if (order.subtotalCents + order.shippingCents !== order.totalCents) broken.push(order.id + ': subtotal + shipping != total')
      const payments = paid.get(order.id) ?? []
      if (payments.length !== 1 || payments[0] !== order.totalCents) broken.push(order.id + ': payment.succeeded ' + JSON.stringify(payments))
    }
    for (const product of await db.select({ id: schema.products.id, stock: schema.products.stock }).from(schema.products)) {
      if (product.stock !== null && product.stock < 0) broken.push(product.id + ': negative stock')
    }
    return { count: orders.length, broken }
  `,
	)
	expect(result.count).toBeGreaterThan(1000)
	expect(result.broken).toEqual([])
})

test('an injected transfer failure is logged and leaves the order paid, never half-written', async ({
	playwright,
}) => {
	// The fake Stripe rejects transfers to `acct_fail`.
	const seller = await makeSeller(playwright, 'acct_fail')
	const product = await listProduct(seller, 'physical')
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[product.id]])
	await pay(buyer.api, orderId)

	const { order, sellers, logs } = ledger(orderId)
	expect(order.status).toBe('paid')
	expect(sellers[0]?.stripeTransferId).toBeNull()
	expect(logs.filter((log) => log.type === 'transfer.created')).toHaveLength(0)
	expect(
		logs.filter((log) => log.type === 'transfer.failed').map((log) => log.amountCents),
	).toEqual([sellers[0]?.payoutCents])
})

test('an injected refund failure is a 502 and changes no state', async ({ playwright }) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical')
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[product.id]])
	// A payment intent id containing `refund_fail` makes the fake Stripe reject the refund.
	await pay(buyer.api, orderId, `pi_qa_refund_fail_${Date.now()}`)
	const sellerOrderId = sellerOrderOf(orderId, seller.shopId)

	const response = await seller.api.post(`/api/v1/shop/orders/${sellerOrderId}/refund`)
	expect(response.status()).toBe(502)
	expect(await response.text()).not.toMatch(/already refunded|stripe\.com|sk_test/i)
	const { order, sellers, logs } = ledger(orderId)
	expect(order.status).toBe('paid')
	expect(sellers[0]?.status).toBe('paid')
	expect(logs.filter((log) => log.type === 'refund.created')).toHaveLength(0)
	expect(logs.filter((log) => log.type === 'refund.failed')).toHaveLength(1)
	// The seller can still ship it: nothing was left half refunded.
	await ok(
		await seller.api.post(`/api/v1/shop/orders/${sellerOrderId}/ship`, {
			data: { carrier: 'usps', trackingCode: 'QA123' },
		}),
	)
})

test('a refund reverses the seller transfer and moves the order to refunded', async ({
	playwright,
}) => {
	const seller = await makeSeller(playwright)
	const product = await listProduct(seller, 'physical', { priceCents: 5000, shippingCents: 700 })
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[product.id]])
	await pay(buyer.api, orderId)
	await ok(
		await seller.api.post(
			`/api/v1/shop/orders/${sellerOrderOf(orderId, seller.shopId)}/refund`,
		),
	)

	const { order, sellers, logs } = ledger(orderId)
	expect(order.status).toBe('refunded')
	expect(logs.find((log) => log.type === 'refund.created')?.amountCents).toBe(5700)
	expect(logs.find((log) => log.type === 'transfer.reversed')?.amountCents).toBe(
		sellers[0]?.payoutCents,
	)
})
