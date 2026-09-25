import { desc, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['tokens'],
		summary: 'List your API tokens',
		description:
			'Session cookie only: API tokens can’t manage tokens. The secret is never returned.',
	},
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	return db
		.select({
			id: schema.apiTokens.id,
			name: schema.apiTokens.name,
			prefix: schema.apiTokens.prefix,
			scopes: schema.apiTokens.scopes,
			lastUsedAt: schema.apiTokens.lastUsedAt,
			expiresAt: schema.apiTokens.expiresAt,
			revokedAt: schema.apiTokens.revokedAt,
			createdAt: schema.apiTokens.createdAt,
		})
		.from(schema.apiTokens)
		.where(eq(schema.apiTokens.userId, user.id))
		.orderBy(desc(schema.apiTokens.createdAt))
})
