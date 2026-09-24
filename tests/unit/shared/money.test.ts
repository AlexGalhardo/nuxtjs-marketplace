import { describe, expect, it } from 'vitest'
import { centsToDollars, dollarsToCents, formatMoney } from '../../../shared/utils/money'

describe('formatMoney', () => {
  it('formats cents as USD', () => {
    expect(formatMoney(1999)).toBe('$19.99')
  })

  it('formats zero', () => {
    expect(formatMoney(0)).toBe('$0.00')
  })

  it('formats whole dollar amounts without dropping cents', () => {
    expect(formatMoney(500)).toBe('$5.00')
  })
})

describe('dollarsToCents', () => {
  it('rounds to the nearest cent to avoid float drift', () => {
    expect(dollarsToCents(19.99)).toBe(1999)
    expect(dollarsToCents(0.1 + 0.2)).toBe(30)
  })
})

describe('centsToDollars', () => {
  it('round-trips with dollarsToCents', () => {
    expect(centsToDollars(dollarsToCents(42.5))).toBe(42.5)
  })
})
