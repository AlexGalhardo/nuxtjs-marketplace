import { getTableColumns, getTableName } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import * as postgresqlSchema from '../../server/db/schema.postgresql'
import * as sqliteSchema from '../../server/db/schema.sqlite'

const sqliteEntries = Object.entries(sqliteSchema).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
const postgresqlEntries = new Map(Object.entries(postgresqlSchema))

describe('dual schema parity (sqlite vs postgresql)', () => {
	it('exports the same set of tables', () => {
		expect([...postgresqlEntries.keys()].sort()).toEqual(sqliteEntries.map(([key]) => key))
	})

	it.each(sqliteEntries)(
		'table "%s" has the same name and columns in both dialects',
		(key, sqliteTable) => {
			const postgresqlTable = postgresqlEntries.get(key)
			expect(postgresqlTable).toBeDefined()

			expect(getTableName(postgresqlTable)).toBe(getTableName(sqliteTable))

			const sqliteColumns = Object.keys(getTableColumns(sqliteTable)).sort()
			const postgresqlColumns = Object.keys(getTableColumns(postgresqlTable)).sort()
			expect(postgresqlColumns).toEqual(sqliteColumns)

			const sqliteNotNull = Object.entries(getTableColumns(sqliteTable))
				.filter(([, column]) => column.notNull)
				.map(([name]) => name)
				.sort()
			const postgresqlNotNull = Object.entries(getTableColumns(postgresqlTable))
				.filter(([, column]) => column.notNull)
				.map(([name]) => name)
				.sort()
			expect(postgresqlNotNull).toEqual(sqliteNotNull)
		},
	)
})
