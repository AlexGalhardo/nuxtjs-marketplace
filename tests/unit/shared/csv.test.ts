import { describe, expect, it } from 'vitest'
import { toCsv } from '../../../shared/utils/csv'

describe('toCsv', () => {
	it('joins rows with CRLF and leaves plain cells alone', () => {
		expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x')
	})

	it('quotes commas, quotes and newlines', () => {
		expect(toCsv(['v'], [['a,b'], ['say "hi"'], ['two\nlines']])).toBe(
			'v\r\n"a,b"\r\n"say ""hi"""\r\n"two\nlines"',
		)
	})

	it('renders null/undefined as empty and dates as ISO', () => {
		expect(toCsv(['a', 'b', 'c'], [[null, undefined, new Date('2026-01-02T03:04:05Z')]])).toBe(
			'a,b,c\r\n,,2026-01-02T03:04:05.000Z',
		)
	})

	it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx'])('neutralizes the formula %j', (value) => {
		expect(toCsv(['v'], [[value]]).split('\r\n')[1]).toMatch(/^"?'/)
	})

	it('keeps negative numbers numeric', () => {
		expect(toCsv(['v'], [[-500]])).toBe('v\r\n-500')
	})
})
