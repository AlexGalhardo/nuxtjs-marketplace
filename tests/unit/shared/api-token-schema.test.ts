import { describe, expect, it } from 'vitest'
import { createApiTokenSchema } from '../../../shared/schemas/api-token'

describe('createApiTokenSchema', () => {
	it('defaults to a 90-day expiry', () => {
		const parsed = createApiTokenSchema.parse({ name: 'ci', scopes: ['products:read'] })
		expect(parsed.expiresInDays).toBe(90)
	})

	it('allows a token that never expires', () => {
		const parsed = createApiTokenSchema.parse({
			name: 'ci',
			scopes: ['orders:write'],
			expiresInDays: null,
		})
		expect(parsed.expiresInDays).toBeNull()
	})

	it.each([
		{ name: '  ', scopes: ['shop:read'] },
		{ name: 'ci', scopes: [] },
		{ name: 'ci', scopes: ['admin:write'] },
		{ name: 'ci', scopes: ['shop:read'], expiresInDays: 7 },
	])('rejects %j', (input) => {
		expect(createApiTokenSchema.safeParse(input).success).toBe(false)
	})
})
