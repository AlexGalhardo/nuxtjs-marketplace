// Money is always integer cents, USD (D4). Format only at the display edge.
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

// Converts a dollar amount typed into a form (e.g. "19.99") to integer cents for the API.
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}
