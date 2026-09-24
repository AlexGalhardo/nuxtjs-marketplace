import { describe, expect, it } from 'vitest'
import { loginSchema, nameSchema, passwordSchema, signupSchema } from '../../../shared/schemas/auth'

describe('nameSchema', () => {
	it.each(['Ann', '', 'Al'])('rejects names shorter than 4 characters (%s)', (name) => {
		expect(nameSchema.safeParse(name).success).toBe(false)
	})

	it('trims surrounding whitespace', () => {
		expect(nameSchema.parse('  Alex Vieira  ')).toBe('Alex Vieira')
	})

	it('rejects names longer than 24 characters', () => {
		expect(nameSchema.safeParse('a'.repeat(25)).success).toBe(false)
	})

	it('accepts a valid name', () => {
		expect(nameSchema.parse('Alex Vieira')).toBe('Alex Vieira')
	})
})

describe('passwordSchema', () => {
	it.each([
		['short1!A', true],
		['nouppercase1!', false],
		['NOLOWERCASE1!', false],
		['NoDigitsHere!', false],
		['NoSpecialChar1', false],
		['a'.repeat(33), false],
		['Ab1!Ab1!', true],
	])('validates %s => %s', (password, expected) => {
		expect(passwordSchema.safeParse(password).success).toBe(expected)
	})
})

describe('signupSchema', () => {
	it('accepts a valid signup payload', () => {
		const result = signupSchema.safeParse({
			name: 'Alex Vieira',
			email: 'alex@example.com',
			password: 'Ab1!Ab1!',
		})
		expect(result.success).toBe(true)
	})

	it('rejects an invalid email', () => {
		const result = signupSchema.safeParse({
			name: 'Alex Vieira',
			email: 'not-an-email',
			password: 'Ab1!Ab1!',
		})
		expect(result.success).toBe(false)
	})
})

describe('loginSchema', () => {
	it('requires a non-empty password but does not enforce complexity', () => {
		expect(loginSchema.safeParse({ email: 'alex@example.com', password: 'x' }).success).toBe(
			true,
		)
		expect(loginSchema.safeParse({ email: 'alex@example.com', password: '' }).success).toBe(
			false,
		)
	})
})
