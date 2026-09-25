import { and, count, eq, isNull } from 'drizzle-orm'
import { createApiTokenSchema } from '#shared/schemas/api-token'

defineRouteMeta({
	openAPI: {
		tags: ['tokens'],
		summary: 'Create an API token',
		description:
			'Session cookie only. Returns the raw `token` exactly once; only its SHA-256 hash is stored.',
	},
})

// Keeps a leaked session from minting an unbounded number of tokens.
const maxActiveTokens = 20

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const { name, scopes, expiresInDays } = await readValidatedBody(
		event,
		createApiTokenSchema.parse,
	)
	const [shop] = await db
		.select({ id: schema.shops.id })
		.from(schema.shops)
		.where(eq(schema.shops.ownerId, user.id))
	if (!shop) {
		throw createError({ statusCode: 409, statusMessage: 'Create your shop first' })
	}
	const [active] = await db
		.select({ total: count() })
		.from(schema.apiTokens)
		.where(and(eq(schema.apiTokens.userId, user.id), isNull(schema.apiTokens.revokedAt)))
	if ((active?.total ?? 0) >= maxActiveTokens) {
		throw createError({
			statusCode: 409,
			statusMessage: `You can have up to ${maxActiveTokens} active tokens. Revoke one first`,
		})
	}

	const prefix = generateToken(4)
	const token = `rs_${prefix}_${generateToken(24)}`
	const [created] = await db
		.insert(schema.apiTokens)
		.values({
			userId: user.id,
			shopId: shop.id,
			name,
			prefix: `rs_${prefix}`,
			tokenHash: hashToken(token),
			scopes: [...new Set(scopes)],
			expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
		})
		.returning()
	if (!created) {
		throw createError({ statusCode: 500, statusMessage: 'Could not create the token' })
	}

	const { tokenHash: _hash, ...record } = created
	setResponseStatus(event, 201)
	return { ...record, token }
})
