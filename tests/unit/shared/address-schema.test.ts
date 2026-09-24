import { describe, expect, it } from 'vitest'
import { addressSchema } from '../../../shared/schemas/address'

const validAddress = {
	fullName: 'Alex Vieira',
	line1: '123 Main St',
	city: 'Springfield',
	state: 'IL',
	postalCode: '62704',
	country: 'us',
	phone: '+1 555-0100',
}

describe('addressSchema', () => {
	it('accepts a valid address and defaults isDefault to false', () => {
		const result = addressSchema.parse(validAddress)
		expect(result.isDefault).toBe(false)
	})

	it('uppercases the country code', () => {
		expect(addressSchema.parse(validAddress).country).toBe('US')
	})

	it('rejects a country code that is not exactly 2 letters', () => {
		expect(addressSchema.safeParse({ ...validAddress, country: 'usa' }).success).toBe(false)
	})

	it.each(['fullName', 'line1', 'city', 'state', 'postalCode', 'phone'])(
		'requires %s',
		(field) => {
			const invalid = { ...validAddress, [field]: '' }
			expect(addressSchema.safeParse(invalid).success).toBe(false)
		},
	)

	it('allows an optional line2', () => {
		expect(addressSchema.safeParse(validAddress).success).toBe(true)
		expect(addressSchema.safeParse({ ...validAddress, line2: 'Apt 4' }).success).toBe(true)
	})
})
