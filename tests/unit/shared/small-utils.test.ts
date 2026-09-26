import { describe, expect, it } from 'vitest'
import { cartItemSchema, cartQuantitySchema, checkoutSchema } from '../../../shared/schemas/cart'
import { newId } from '../../../shared/utils/id'
import { blobFileName, mediaUrl } from '../../../shared/utils/media'
import { productTypeIcon } from '../../../shared/utils/product-type-icon'

describe('newId', () => {
	it('is a UUIDv7 that sorts by creation time', () => {
		const first = newId()
		const second = newId()
		expect(first).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		)
		expect(first.slice(0, 13) <= second.slice(0, 13)).toBe(true)
		const ms = Number.parseInt(first.replace('-', '').slice(0, 12), 16)
		expect(Math.abs(ms - Date.now())).toBeLessThan(5_000)
	})
})

describe('blobFileName', () => {
	it('keeps a safe name and extension', () => {
		expect(blobFileName('Summer Dress.JPG')).toBe('summer-dress.jpg')
	})
	it('cannot climb out of the upload prefix', () => {
		expect(blobFileName('../../files/products/x/secret.pdf')).toBe(
			'files-products-x-secret.pdf',
		)
		expect(blobFileName('....evil.png')).toBe('evil.png')
	})
	it('neutralizes percent signs that used to crash decodeURIComponent', () => {
		expect(blobFileName('50% off.png')).toBe('50-off.png')
		expect(blobFileName('%2e%2e%2fx.png')).toBe('2e-2e-2fx.png')
	})
	it('falls back to a name when nothing usable is left', () => {
		expect(blobFileName('.png')).toBe('file.png')
		expect(blobFileName('???')).toBe('file')
	})
})

describe('mediaUrl', () => {
	it('prefixes blob keys and leaves absolute URLs alone', () => {
		expect(mediaUrl('images/a.webp')).toBe('/images/a.webp')
		expect(mediaUrl('https://cdn.example.com/1.webp')).toBe('https://cdn.example.com/1.webp')
	})
})

describe('productTypeIcon', () => {
	it('maps known slugs and falls back to a tag', () => {
		expect(productTypeIcon('books')).toBe('i-lucide-book-open')
		expect(productTypeIcon('unknown')).toBe('i-lucide-tag')
	})
})

describe('cart schemas', () => {
	it('defaults quantity to 1 and caps it', () => {
		expect(cartItemSchema.parse({ productId: 'p' }).quantity).toBe(1)
		expect(cartItemSchema.safeParse({ productId: 'p', quantity: 100 }).success).toBe(false)
		expect(cartQuantitySchema.safeParse({ quantity: 0 }).success).toBe(false)
		expect(checkoutSchema.parse({})).toEqual({})
	})
})
