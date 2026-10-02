// Readiness probe for Docker, Railway, CI and smoke tests: 503 when the database is unreachable, so a
// deploy that can't reach it never takes traffic. Intentionally exposes no version or config details.
export default defineEventHandler(async () => {
	try {
		await db.select({ id: schema.productTypes.id }).from(schema.productTypes).limit(1)
	} catch {
		throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
	}
	return { status: 'ok' }
})
