import { and, eq, isNull } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['tokens'],
		summary: 'Revoke an API token',
		description: 'Session cookie only. Revocation is immediate and permanent.',
	},
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const id = getRouterParam(event, 'id') ?? ''
	const [token] = await db
		.select({ id: schema.apiTokens.id, revokedAt: schema.apiTokens.revokedAt })
		.from(schema.apiTokens)
		.where(and(eq(schema.apiTokens.id, id), eq(schema.apiTokens.userId, user.id)))
	if (!token) {
		throw createError({ statusCode: 404, statusMessage: 'Token not found' })
	}
	await db
		.update(schema.apiTokens)
		.set({ revokedAt: new Date() })
		.where(and(eq(schema.apiTokens.id, id), isNull(schema.apiTokens.revokedAt)))
	setResponseStatus(event, 204)
	return null
})
