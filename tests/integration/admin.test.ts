import { $fetch, fetch } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ProductType } from '../../shared/types/db'
import { dbQuery } from './helpers/db'

// Phase 11: admin listings, shop/product moderation, transaction log filters + CSV, audit log.
const run = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
const ids: Record<string, string> = {}
const cookies: Record<string, string> = {}
const password = 'Ab1!Ab1!'

async function signUp(name: string) {
	const response = await fetch('/api/auth/signup', {
		method: 'POST',
		body: JSON.stringify({
			name: `${name} tester`,
			email: `${name}-admin-${run}@example.com`,
			password,
		}),
		headers: { 'content-type': 'application/json' },
	})
	if (!response.ok) throw new Error(`signup failed: ${response.status}`)
	return response.headers.get('set-cookie')?.split(';')[0] ?? ''
}

function api(path: string, cookie: string, init: { method?: string; body?: unknown } = {}) {
	return fetch(path, {
		method: init.method ?? 'GET',
		headers: { cookie, 'content-type': 'application/json' },
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	})
}

function auditRows(targetId: string) {
	return dbQuery<{ action: string; actorId: string; metadata: { reason?: string } }[]>(`
		return db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, '${targetId}'))
	`)
}

beforeAll(async () => {
	cookies.seller = await signUp('seller')
	cookies.user = await signUp('user')
	await signUp('boss')
	// The role lives in the session, so promote first and then log in again.
	ids.admin = dbQuery<string>(`
		const [row] = await db.update(schema.users).set({ role: 'admin' })
			.where(eq(schema.users.email, 'boss-admin-${run}@example.com')).returning()
		return row.id
	`)
	const login = await fetch('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email: `boss-admin-${run}@example.com`, password }),
		headers: { 'content-type': 'application/json' },
	})
	cookies.admin = login.headers.get('set-cookie')?.split(';')[0] ?? ''

	const shop = await $fetch<{ id: string }>('/api/v1/shop', {
		method: 'POST',
		headers: { cookie: cookies.seller },
		body: { name: 'Moderated Goods', slug: `moderated-${run}` },
	})
	ids.shop = shop.id
	dbQuery(`
		await db.update(schema.shops).set({ chargesEnabled: true }).where(eq(schema.shops.id, '${shop.id}'))
		await db.insert(schema.transactionLogs).values([
			{ type: 'payment.succeeded', amountCents: 1234, status: 'succeeded', shopId: '${shop.id}', payload: { note: '=HYPERLINK("x")' }, createdAt: new Date('2026-01-15T12:00:00Z') },
			{ type: 'transfer.failed', amountCents: 999, status: 'failed', shopId: '${shop.id}', payload: {}, createdAt: new Date('2026-02-01T00:00:00Z') },
		])
	`)
	const types = await $fetch<ProductType[]>('/api/product-types')
	const product = await $fetch<{ id: string }>('/api/v1/shop/products', {
		method: 'POST',
		headers: { cookie: cookies.seller },
		body: {
			productTypeId: types.find((type) => type.kind === 'digital')?.id,
			title: 'questionable ebook',
			slug: `questionable-${run}`,
			description: 'Admin integration test product.',
			priceCents: 900,
		},
	})
	ids.product = product.id
	await $fetch(`/api/v1/shop/products/${product.id}/publish`, {
		method: 'POST',
		headers: { cookie: cookies.seller },
	})
})

describe('access', () => {
	const routes = [
		'/api/admin/stats',
		'/api/admin/users',
		'/api/admin/shops',
		'/api/admin/products',
		'/api/admin/transaction-logs',
		'/api/admin/transaction-logs/export',
		'/api/admin/audit-logs',
	]

	it('is admin-only', async () => {
		for (const path of routes) {
			expect((await fetch(path)).status, path).toBe(401)
			expect((await api(path, cookies.user ?? '')).status, path).toBe(403)
			expect((await api(path, cookies.admin ?? '')).status, path).toBe(200)
		}
		const patch = await api(`/api/admin/shops/${ids.shop}`, cookies.user ?? '', {
			method: 'PATCH',
			body: { status: 'suspended', reason: 'not an admin' },
		})
		expect(patch.status).toBe(403)
	})
})

describe('listings', () => {
	it('searches users, shops and products', async () => {
		const users = (await (
			await api(`/api/admin/users?q=boss-admin-${run}`, cookies.admin ?? '')
		).json()) as { data: { role: string }[]; meta: { total: number } }
		expect(users.meta.total).toBe(1)
		expect(users.data[0]?.role).toBe('admin')

		const shops = (await (
			await api(`/api/admin/shops?q=moderated-${run}`, cookies.admin ?? '')
		).json()) as { data: { id: string; products: number; ownerEmail: string }[] }
		expect(shops.data).toEqual([
			expect.objectContaining({
				id: ids.shop,
				products: 1,
				ownerEmail: `seller-admin-${run}@example.com`,
			}),
		])

		const products = (await (
			await api(
				`/api/admin/products?q=questionable-${run}&status=published`,
				cookies.admin ?? '',
			)
		).json()) as { data: { id: string }[] }
		expect(products.data.map((row) => row.id)).toEqual([ids.product])
	})

	it('validates queries', async () => {
		expect((await api('/api/admin/shops?status=nope', cookies.admin ?? '')).status).toBe(400)
		expect((await api('/api/admin/users?perPage=500', cookies.admin ?? '')).status).toBe(400)
	})
})

describe('moderation', () => {
	it('suspends a product: gone from the catalog, seller can’t republish, audited', async () => {
		const suspend = await api(`/api/admin/products/${ids.product}`, cookies.admin ?? '', {
			method: 'PATCH',
			body: { status: 'suspended', reason: 'counterfeit' },
		})
		expect(suspend.status).toBe(200)
		expect((await fetch(`/api/products/questionable-${run}`)).status).toBe(404)
		for (const action of ['publish', 'archive']) {
			const retry = await api(
				`/api/v1/shop/products/${ids.product}/${action}`,
				cookies.seller ?? '',
				{
					method: 'POST',
				},
			)
			expect(retry.status, action).toBe(409)
		}
		expect(
			(
				await api(`/api/admin/products/${ids.product}`, cookies.admin ?? '', {
					method: 'PATCH',
					body: { status: 'suspended', reason: 'again' },
				})
			).status,
		).toBe(409)

		const reinstate = await api(`/api/admin/products/${ids.product}`, cookies.admin ?? '', {
			method: 'PATCH',
			body: { status: 'archived', reason: 'seller proved it’s genuine' },
		})
		expect(await reinstate.json()).toMatchObject({ status: 'archived' })
		expect(auditRows(ids.product ?? '')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					action: 'product.suspended',
					actorId: ids.admin,
					metadata: expect.objectContaining({ reason: 'counterfeit', from: 'published' }),
				}),
				expect.objectContaining({ action: 'product.reinstated' }),
			]),
		)
		await $fetch(`/api/v1/shop/products/${ids.product}/publish`, {
			method: 'POST',
			headers: { cookie: cookies.seller },
		})
	})

	it('suspends a shop: its listings disappear, reinstating brings them back', async () => {
		expect(
			(
				await api(`/api/admin/shops/${ids.shop}`, cookies.admin ?? '', {
					method: 'PATCH',
					body: { status: 'suspended', reason: '' },
				})
			).status,
		).toBe(400)
		const suspend = await api(`/api/admin/shops/${ids.shop}`, cookies.admin ?? '', {
			method: 'PATCH',
			body: { status: 'suspended', reason: 'chargeback ring' },
		})
		expect(await suspend.json()).toMatchObject({ status: 'suspended' })
		expect((await fetch(`/api/products/questionable-${run}`)).status).toBe(404)
		expect((await fetch(`/api/shops/moderated-${run}`)).status).toBe(404)

		await api(`/api/admin/shops/${ids.shop}`, cookies.admin ?? '', {
			method: 'PATCH',
			body: { status: 'active', reason: 'cleared' },
		})
		expect((await fetch(`/api/products/questionable-${run}`)).status).toBe(200)
		expect(auditRows(ids.shop ?? '').map((row) => row.action)).toEqual(
			expect.arrayContaining(['shop.suspended', 'shop.reinstated']),
		)
		expect(
			(
				await api('/api/admin/shops/nope', cookies.admin ?? '', {
					method: 'PATCH',
					body: { status: 'suspended', reason: 'missing' },
				})
			).status,
		).toBe(404)
	})
})

describe('transaction logs', () => {
	it('filters by type, shop and inclusive date range', async () => {
		const list = async (query: string) =>
			(await (
				await api(
					`/api/admin/transaction-logs?shopId=${ids.shop}&${query}`,
					cookies.admin ?? '',
				)
			).json()) as { data: { type: string }[]; types: string[]; meta: { total: number } }
		expect((await list('')).meta.total).toBe(2)
		expect((await list('type=transfer.failed')).data.map((row) => row.type)).toEqual([
			'transfer.failed',
		])
		expect((await list('from=2026-01-15&to=2026-01-15')).meta.total).toBe(1)
		expect((await list('from=2026-01-16&to=2026-01-31')).meta.total).toBe(0)
		expect((await list('')).types).toEqual(expect.arrayContaining(['payment.succeeded']))
		const bad = await api(
			'/api/admin/transaction-logs?from=2026-02-01&to=2026-01-01',
			cookies.admin ?? '',
		)
		expect(bad.status).toBe(400)
	})

	it('exports the filtered rows as CSV and audits the export', async () => {
		const response = await api(
			`/api/admin/transaction-logs/export?shopId=${ids.shop}&type=payment.succeeded`,
			cookies.admin ?? '',
		)
		expect(response.headers.get('content-type')).toContain('text/csv')
		expect(response.headers.get('content-disposition')).toContain('attachment')
		const lines = (await response.text()).split('\r\n')
		expect(lines[0]).toMatch(/^created_at,type,status,amount_cents/)
		expect(lines).toHaveLength(2)
		expect(lines[1]).toContain('payment.succeeded,succeeded,1234,usd')
		expect(lines[1]).toContain('"{""note"":""=HYPERLINK(\\""x\\"")""}"')

		const audit = (await (await api('/api/admin/audit-logs', cookies.admin ?? '')).json()) as {
			data: { action: string; actorName: string; metadata: { filters: object } }[]
		}
		expect(audit.data).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					action: 'transaction_logs.exported',
					actorName: 'boss tester',
					metadata: expect.objectContaining({
						filters: { shopId: ids.shop, type: 'payment.succeeded' },
					}),
				}),
			]),
		)
	})
})
