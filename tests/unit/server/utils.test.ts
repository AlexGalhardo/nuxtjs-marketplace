import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '../../../server/db/schema.sqlite'
import { pageMeta, searchAny } from '../../../server/utils/admin'
import { logAudit } from '../../../server/utils/audit'
import { apiTokenScopeFor } from '../../../server/utils/auth'
import { isValidDownloadSignature, signedDownloadUrl } from '../../../server/utils/downloads'
import { sendMail } from '../../../server/utils/mail'
import { logSecurityEvent } from '../../../server/utils/security-log'
import { toSafeUser } from '../../../server/utils/session'
import { getStripeClient } from '../../../server/utils/stripe'
import { generateToken, hashToken } from '../../../server/utils/token'
import { transactionLogWhere } from '../../../server/utils/transaction-log-query'
import { logTransaction } from '../../../server/utils/transactions'
import { readUploadForm } from '../../../server/utils/upload'
import { resetRuntimeConfig, runtimeConfig } from './nitro-globals'

const send = vi.fn()
vi.mock('resend', () => ({
	Resend: class {
		emails = { send }
	},
}))

beforeEach(() => {
	resetRuntimeConfig()
	vi.stubGlobal('schema', schema)
})

function fakeClient() {
	const values = vi.fn(async () => undefined)
	const insert = vi.fn(() => ({ values }))
	return { client: { insert } as never, insert, values }
}

describe('token', () => {
	it('generates hex of the requested size and hashes deterministically', () => {
		expect(generateToken(4)).toMatch(/^[0-9a-f]{8}$/)
		expect(generateToken()).toHaveLength(64)
		expect(hashToken('abc')).toBe(hashToken('abc'))
		expect(hashToken('abc')).not.toBe(hashToken('abd'))
	})
})

describe('downloads', () => {
	function parts(url: string) {
		const parsed = new URL(url, 'http://x')
		return {
			grantId: parsed.pathname.split('/').pop() ?? '',
			expires: Number(parsed.searchParams.get('expires')),
			signature: parsed.searchParams.get('signature') ?? '',
		}
	}

	it('accepts its own fresh signature only for the same grant and expiry', () => {
		const { grantId, expires, signature } = parts(signedDownloadUrl('grant-1'))
		expect(grantId).toBe('grant-1')
		expect(isValidDownloadSignature('grant-1', expires, signature)).toBe(true)
		expect(isValidDownloadSignature('grant-2', expires, signature)).toBe(false)
		expect(isValidDownloadSignature('grant-1', expires + 1, signature)).toBe(false)
	})

	it('rejects expired links and fails closed without a secret', () => {
		expect(isValidDownloadSignature('grant-1', Date.now() - 1, 'ab')).toBe(false)
		runtimeConfig.session.password = ''
		expect(() => signedDownloadUrl('grant-1')).toThrow('Downloads are not configured')
	})
})

describe('apiTokenScopeFor', () => {
	it.each([
		['GET', '/api/v1/shop', 'shop:read'],
		['PATCH', '/api/v1/shop', 'shop:write'],
		['PUT', '/api/v1/shop/branding/:kind', 'shop:write'],
		['GET', '/api/v1/shop/products?page=2', 'products:read'],
		['HEAD', '/api/v1/shop/products/:id', 'products:read'],
		['POST', '/api/v1/shop/products/:id/publish', 'products:write'],
		['GET', '/api/v1/shop/orders', 'orders:read'],
		['POST', '/api/v1/shop/orders/:id/refund', 'orders:write'],
		['GET', '/api/v1/shop/tokens', null],
		['POST', '/api/v1/shop/stripe/onboarding', null],
		['GET', '/api/v1/shopping', null],
		['GET', '/api/cart', null],
		['GET', '/api/admin/users', null],
	])('%s %s → %s', (method, path, scope) => {
		expect(apiTokenScopeFor(method, path)).toBe(scope)
	})
})

describe('audit and transaction logs', () => {
	it('insert append-only rows with defaults through the given client', async () => {
		const audit = fakeClient()
		await logAudit(
			{ actorId: 'u1', action: 'shop.suspended', targetType: 'shop' },
			audit.client,
		)
		expect(audit.insert).toHaveBeenCalledWith(schema.auditLogs)
		expect(audit.values).toHaveBeenCalledWith(expect.objectContaining({ metadata: null }))

		const money = fakeClient()
		await logTransaction(
			{ type: 'refund.created', amountCents: 100, status: 'ok' },
			money.client,
		)
		expect(money.insert).toHaveBeenCalledWith(schema.transactionLogs)
		expect(money.values).toHaveBeenCalledWith(expect.objectContaining({ payload: {} }))
	})
})

describe('admin helpers', () => {
	it('skips an empty search and builds a clause otherwise', () => {
		expect(searchAny(undefined, [])).toBeUndefined()
		expect(searchAny('', [])).toBeUndefined()
		expect(searchAny('Shoe', [])).toBeDefined()
		expect(pageMeta({ page: 2, perPage: 10 }, undefined)).toEqual({
			page: 2,
			perPage: 10,
			total: 0,
		})
	})
})

describe('transactionLogWhere', () => {
	const render = (where: ReturnType<typeof transactionLogWhere>) =>
		where ? new SQLiteSyncDialect().sqlToQuery(where) : undefined

	it('adds nothing without filters', () => {
		expect(transactionLogWhere({ page: 1, perPage: 25 })).toBeUndefined()
	})

	it('makes the date range whole UTC days, `to` inclusive', () => {
		const query = render(
			transactionLogWhere({
				type: 'refund.created',
				from: '2026-01-15',
				to: '2026-01-15',
				page: 1,
				perPage: 25,
			}),
		)
		// Timestamps are stored in seconds on SQLite.
		expect(query?.params).toEqual([
			'refund.created',
			Date.parse('2026-01-15T00:00:00Z') / 1000,
			Date.parse('2026-01-16T00:00:00Z') / 1000,
		])
		expect(query?.sql).toMatch(/>= \?.*< \?/)
	})
})

describe('session', () => {
	it('never exposes the password hash', () => {
		const user = { id: '1', name: 'A', email: 'a@x.dev', role: 'user', passwordHash: 'secret' }
		expect(toSafeUser(user as never)).toEqual({
			id: '1',
			name: 'A',
			email: 'a@x.dev',
			role: 'user',
		})
	})
})

describe('stripe', () => {
	it('fails closed with 501 when not configured, and builds one client when it is', () => {
		expect(() => getStripeClient()).toThrow('Stripe is not configured')
		runtimeConfig.stripe = { secretKey: 'sk_test_x', apiBase: 'http://127.0.0.1:12111' }
		const client = getStripeClient()
		expect(getStripeClient()).toBe(client)
	})
})

describe('upload', () => {
	it('turns a body that is not multipart into a 400 instead of a 500', async () => {
		const form = new FormData()
		vi.stubGlobal('readFormData', async () => form)
		expect(await readUploadForm({} as never)).toBe(form)
		vi.stubGlobal('readFormData', async () => {
			throw new TypeError('Failed to parse body as FormData.')
		})
		await expect(readUploadForm({} as never)).rejects.toMatchObject({ statusCode: 400 })
	})
})

describe('mail', () => {
	it('logs instead of sending without an API key', async () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
		await sendMail({ to: 'a@x.dev', subject: 'hi', text: 'body' })
		expect(info).toHaveBeenCalledWith(expect.stringContaining('Subject: hi'))
		info.mockRestore()
	})


	it('sends through Resend with a key, and turns a Resend error into a 502', async () => {
		runtimeConfig.resend.apiKey = 're_test'
		send.mockResolvedValueOnce({ error: null })
		await sendMail({ to: 'a@x.dev', subject: 'hi', text: 'body' })
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'a@x.dev', from: 'onboarding@resend.dev' }),
		)
		send.mockResolvedValueOnce({ error: { message: 'nope' } })
		await expect(sendMail({ to: 'a@x.dev', subject: 'hi', text: 'b' })).rejects.toMatchObject({
			statusCode: 502,
		})
	})
})

describe('logSecurityEvent', () => {
	it('writes one JSON line with the event, client IP and ids only', () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => {})
		// X-Real-IP is set (overwritten) by the reverse proxy; x-forwarded-for is client-spoofable.
		const event = {
			context: {},
			node: {
				req: { headers: { 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6' } },
			},
		} as never
		logSecurityEvent(event, 'login.failed', { userId: null, reason: 'unknown_email' })
		expect(info).toHaveBeenCalledOnce()
		const line = JSON.parse(String(info.mock.calls[0]?.[0]))
		expect(line).toMatchObject({
			security: 'login.failed',
			ip: '203.0.113.9',
			userId: null,
			reason: 'unknown_email',
		})
		expect(Number.isNaN(Date.parse(line.at))).toBe(false)
		info.mockRestore()
	})
})
