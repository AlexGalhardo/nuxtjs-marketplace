import { type AnyColumn, type SQL, sql } from 'drizzle-orm'

// Case-insensitive substring match on any of `columns`, parameterized (A05), same SQL on both dialects.
export function searchAny(q: string | undefined, columns: AnyColumn[]): SQL | undefined {
	if (!q) return undefined
	const pattern = `%${q.toLowerCase()}%`
	return sql`(${sql.join(
		columns.map((column) => sql`lower(${column}) like ${pattern}`),
		sql` or `,
	)})`
}

export function pageMeta(
	query: { page: number; perPage: number },
	total: number | undefined,
): { page: number; perPage: number; total: number } {
	return { page: query.page, perPage: query.perPage, total: total ?? 0 }
}
