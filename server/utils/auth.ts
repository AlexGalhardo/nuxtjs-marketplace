import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { ApiTokenScope } from '#shared/schemas/api-token'

// OWASP A01: deny by default. Every protected handler calls one of these instead of reading
// the session/token directly, so ownership checks stay consistent across the app.

// nuxt-auth-utils only runs the `fetch` session hook for its own client-facing
// GET /api/_auth/session route, never for requireUserSession() calls in our own handlers
// (verified in nuxt-auth-utils@0.5.30's server/api/session.get.js vs server/utils/session.js).
// So the password-change invalidation check has to live here, not in a session hook.
export async function requireUser(event: H3Event): Promise<AuthUser> {
	// D14: /api/v1/shop/** also accepts `Authorization: Bearer <token>`, scoped per route.
	if (/^Bearer\s/i.test(getHeader(event, 'authorization') ?? '')) {
		return requireTokenUser(event)
	}
	const { user, passwordVersion } = await requireUserSession(event)
	const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.id, user.id))
	if (!dbUser || hashToken(dbUser.passwordHash) !== passwordVersion) {
		await clearUserSession(event)
		throw createError({
			statusCode: 401,
			statusMessage: 'Session expired, please log in again',
		})
	}
	return user
}

type AuthUser = Awaited<ReturnType<typeof requireUserSession>>['user']

// The scope a token needs for this request, or null when tokens aren't accepted here at all
// (everything outside /api/v1/shop, token management itself, and Stripe onboarding, which is a
// browser redirect flow).
export function apiTokenScopeFor(method: string, path: string): ApiTokenScope | null {
	const match = path.split('?')[0]?.match(/^\/api\/v1\/shop(?:\/([^/]+))?(?:\/|$)/)
	if (!match) return null
	const resource = match[1]
	if (resource === 'tokens' || resource === 'stripe') return null
	const area = resource === 'products' || resource === 'orders' ? resource : 'shop'
	const access = method === 'GET' || method === 'HEAD' ? 'read' : 'write'
	return `${area}:${access}`
}

async function requireTokenUser(event: H3Event): Promise<AuthUser> {
	// Classify by the route pattern the router actually matched, not the raw path, so path
	// variants (`//tokens`, encoded segments) can't be scoped differently from where they land.
	const scope = apiTokenScopeFor(event.method, event.context.matchedRoute?.path ?? event.path)
	if (!scope) {
		throw createError({
			statusCode: 403,
			statusMessage: 'API tokens can’t be used on this endpoint',
		})
	}
	const token = await requireApiToken(event, [scope])
	const [user] = await db
		.select({
			id: schema.users.id,
			name: schema.users.name,
			email: schema.users.email,
			role: schema.users.role,
		})
		.from(schema.users)
		.where(eq(schema.users.id, token.userId))
	if (!user) {
		throw createError({ statusCode: 401, statusMessage: 'Invalid API token' })
	}
	return user
}

export async function requireAdmin(event: H3Event) {
	const user = await requireUser(event)
	if (user.role !== 'admin') {
		throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
	}
	return user
}

// Verifies the current session user owns the shop (or is an admin) before returning it.
export async function requireShopOwner(event: H3Event, shopId: string) {
	const user = await requireUser(event)
	const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId))
	if (!shop) {
		throw createError({ statusCode: 404, statusMessage: 'Shop not found' })
	}
	if (shop.ownerId !== user.id && user.role !== 'admin') {
		throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
	}
	return shop
}

// Verifies the current session user owns the shop that a product belongs to (or is an admin).
export async function requireProductOwner(event: H3Event, productId: string) {
	const user = await requireUser(event)
	const [product] = await db
		.select()
		.from(schema.products)
		.where(eq(schema.products.id, productId))
	if (!product) {
		throw createError({ statusCode: 404, statusMessage: 'Product not found' })
	}
	const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.id, product.shopId))
	if (!shop) {
		throw createError({ statusCode: 404, statusMessage: 'Product not found' })
	}
	if (shop.ownerId !== user.id && user.role !== 'admin') {
		throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
	}
	return { product, shop }
}

// ponytail: in-memory fixed window per token, per server process; move to shared storage
// (NuxtHub KV/Redis) if the app ever runs more than one instance.
export const apiTokenRateLimit = { requests: 120, windowMs: 60_000 }
const tokenWindows = new Map<string, { start: number; count: number }>()

function enforceTokenRateLimit(event: H3Event, tokenId: string): void {
	const now = Date.now()
	let window = tokenWindows.get(tokenId)
	if (!window || now - window.start >= apiTokenRateLimit.windowMs) {
		window = { start: now, count: 0 }
		tokenWindows.set(tokenId, window)
	}
	window.count += 1
	const remaining = Math.max(apiTokenRateLimit.requests - window.count, 0)
	setHeader(event, 'x-ratelimit-limit', apiTokenRateLimit.requests)
	setHeader(event, 'x-ratelimit-remaining', remaining)
	if (window.count > apiTokenRateLimit.requests) {
		const retryAfter = Math.ceil((window.start + apiTokenRateLimit.windowMs - now) / 1000)
		setHeader(event, 'retry-after', retryAfter)
		throw createError({ statusCode: 429, statusMessage: 'API token rate limit exceeded' })
	}
}

// Bearer API token auth (D14). Tokens are stored hashed; the raw value is only ever shown once
// at creation time.
export async function requireApiToken(event: H3Event, requiredScopes: string[] = []) {
	const authorization = getHeader(event, 'authorization') ?? ''
	const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
	if (!token) {
		throw createError({ statusCode: 401, statusMessage: 'Missing API token' })
	}

	const [record] = await db
		.select()
		.from(schema.apiTokens)
		.where(eq(schema.apiTokens.tokenHash, hashToken(token)))
	if (!record) {
		throw createError({ statusCode: 401, statusMessage: 'Invalid API token' })
	}
	if (record.revokedAt) {
		throw createError({ statusCode: 401, statusMessage: 'API token revoked' })
	}
	if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
		throw createError({ statusCode: 401, statusMessage: 'API token expired' })
	}
	enforceTokenRateLimit(event, record.id)
	const missingScope = requiredScopes.find((scope) => !record.scopes.includes(scope))
	if (missingScope) {
		throw createError({
			statusCode: 403,
			statusMessage: `Missing required scope: ${missingScope}`,
		})
	}

	await db
		.update(schema.apiTokens)
		.set({ lastUsedAt: new Date() })
		.where(eq(schema.apiTokens.id, record.id))

	return record
}
