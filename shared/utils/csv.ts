// RFC 4180 CSV. Cells starting with = + - @ (or tab/CR) get a leading ' so spreadsheet apps treat
// them as text, not formulas (OWASP "CSV injection"). Negative numbers stay numbers.
export function toCsv(header: string[], rows: unknown[][]): string {
	return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

function csvCell(value: unknown): string {
	if (value === null || value === undefined) return ''
	if (typeof value === 'number') return String(value)
	let text = value instanceof Date ? value.toISOString() : String(value)
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
