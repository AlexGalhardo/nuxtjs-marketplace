import { describe, expect, it } from 'vitest'
import { slugify } from '../../../shared/utils/slug'

describe('slugify', () => {
	it('lowercases and hyphenates', () => {
		expect(slugify('My Cool Shop')).toBe('my-cool-shop')
	})

	it('strips diacritics', () => {
		expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu')
	})

	it('collapses non-alphanumeric runs into a single hyphen', () => {
		expect(slugify('Hello!!  World--Wide')).toBe('hello-world-wide')
	})

	it('trims leading and trailing hyphens', () => {
		expect(slugify('  -Shop Name- ')).toBe('shop-name')
	})
})
