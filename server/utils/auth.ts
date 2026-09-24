import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'

// OWASP A01: deny by default. Every protected handler calls one of these instead of reading
// the session/token directly, so ownership checks stay consistent across the app.

// nuxt-auth-utils only runs the `fetch` session hook for its own client-facing
// GET /api/_auth/session route, never for requireUserSession() calls in our own handlers
// (verified in nuxt-auth-utils@0.5.30's server/api/session.get.js vs server/utils/session.js).
// So the password-change invalidation check has to live here, not in a session hook.
export async function requireUser(event: H3Event) {
  const { user, passwordVersion } = await requireUserSession(event)
  const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.id, user.id))
  if (!dbUser || hashToken(dbUser.passwordHash) !== passwordVersion) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Session expired, please log in again' })
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
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, productId))
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

// Bearer API token auth (D14, Phase 10 UI). Tokens are stored hashed; the raw value is only
// ever shown once at creation time.
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
  const missingScope = requiredScopes.find((scope) => !record.scopes.includes(scope))
  if (missingScope) {
    throw createError({ statusCode: 403, statusMessage: `Missing required scope: ${missingScope}` })
  }

  await db
    .update(schema.apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiTokens.id, record.id))

  return record
}
