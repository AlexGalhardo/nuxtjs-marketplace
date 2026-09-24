import { describe, expect, it } from 'vitest'
import { changePasswordSchema, updateProfileSchema } from '../../../shared/schemas/profile'

describe('updateProfileSchema', () => {
	it('accepts a valid name with an optional phone', () => {
		expect(updateProfileSchema.safeParse({ name: 'Alex Vieira' }).success).toBe(true)
		expect(
			updateProfileSchema.safeParse({ name: 'Alex Vieira', phone: '+1 555-0100' }).success,
		).toBe(true)
	})

	it('rejects a name shorter than 4 characters', () => {
		expect(updateProfileSchema.safeParse({ name: 'Al' }).success).toBe(false)
	})
})

describe('changePasswordSchema', () => {
	it('requires a non-empty current password and a strong new password', () => {
		expect(
			changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'Ab1!Ab1!' })
				.success,
		).toBe(true)
		expect(
			changePasswordSchema.safeParse({ currentPassword: '', newPassword: 'Ab1!Ab1!' })
				.success,
		).toBe(false)
		expect(
			changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'weak' }).success,
		).toBe(false)
	})
})
