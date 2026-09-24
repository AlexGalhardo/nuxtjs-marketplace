import { describe, expect, it } from 'vitest'
import { contactSchema } from '../../../shared/schemas/contact'

const validContact = {
	name: 'Jane Doe',
	email: 'jane@example.com',
	subject: 'Question about my order',
	message: 'Hello, I have a question about my recent order. Can you help?',
}

describe('contactSchema', () => {
	it('accepts a valid contact message', () => {
		expect(contactSchema.safeParse(validContact).success).toBe(true)
	})

	it('rejects an invalid email', () => {
		expect(contactSchema.safeParse({ ...validContact, email: 'not-an-email' }).success).toBe(
			false,
		)
	})

	it('rejects a message shorter than 10 characters', () => {
		expect(contactSchema.safeParse({ ...validContact, message: 'too short' }).success).toBe(
			false,
		)
	})

	it.each(['name', 'subject', 'message'])('requires %s', (field) => {
		expect(contactSchema.safeParse({ ...validContact, [field]: '' }).success).toBe(false)
	})
})
