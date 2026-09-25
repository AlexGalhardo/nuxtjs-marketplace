/// <reference path="../../types/nitro-virtual.d.ts" />
// (Explicit reference: the app tsconfig also type-checks this file via typed $fetch routes.)
import { z } from 'zod'
import { handlersMeta } from '#nitro-internal-virtual/server-handlers-meta'
import { createApiTokenSchema } from '#shared/schemas/api-token'
import { shipSellerOrderSchema } from '#shared/schemas/order'
import { productSchema } from '#shared/schemas/product'
import { shopSchema, shopUpdateSchema } from '#shared/schemas/shop'

// GET /api/v1/openapi.json — the public seller API spec (D14), rendered by /my-shop/api-docs.
// Built from each /api/v1 handler's defineRouteMeta(); request bodies come straight from the
// shared Zod schemas the handlers validate with, so the docs can't drift from the validation.
const bodies: Record<string, z.ZodType> = {
	'post /api/v1/shop': shopSchema,
	'patch /api/v1/shop': shopUpdateSchema,
	'post /api/v1/shop/products': productSchema,
	'patch /api/v1/shop/products/:id': productSchema.omit({ slug: true }),
	'patch /api/v1/shop/products/:id/images/:imageId': z.object({ alt: z.string().max(200) }),
	'post /api/v1/shop/products/:id/images/reorder': z.object({ order: z.array(z.string()) }),
	'post /api/v1/shop/orders/:id/ship': shipSellerOrderSchema,
	'post /api/v1/shop/tokens': createApiTokenSchema,
}

const errors = {
	400: { description: 'Invalid input' },
	401: { description: 'Missing or invalid session / API token' },
	403: { description: 'Not yours, or the token lacks the required scope' },
	404: { description: 'Not found (also used for other shops’ resources)' },
	429: { description: 'API token rate limit exceeded (see `retry-after`)' },
}

export default defineEventHandler(() => {
	const paths: Record<string, Record<string, unknown>> = {}
	for (const handler of handlersMeta) {
		const { route, method, meta } = handler
		if (!route?.startsWith('/api/v1/shop') || !method || !meta?.openAPI) continue

		const scope = apiTokenScopeFor(method.toUpperCase(), route)
		const path = route.replace(/:(\w+)/g, '{$1}')
		const body = bodies[`${method} ${route}`]
		paths[path] ??= {}
		paths[path][method] = {
			...meta.openAPI,
			'x-token-scope': scope,
			security: scope ? [{ bearerAuth: [] }, { sessionCookie: [] }] : [{ sessionCookie: [] }],
			parameters: [...route.matchAll(/:(\w+)/g)].map(([, name]) => ({
				name,
				in: 'path',
				required: true,
				schema: { type: 'string' },
			})),
			...(body && {
				requestBody: {
					required: true,
					content: {
						'application/json': { schema: z.toJSONSchema(body, { io: 'input' }) },
					},
				},
			}),
			responses: { 200: { description: 'OK' }, ...errors },
		}
	}

	return {
		openapi: '3.1.0',
		info: {
			title: 'resell.sh seller API',
			version: '1.0.0',
			description: [
				'Manage your shop, products and orders. Create a personal API token at `/my-shop/api-tokens`',
				'and send it as `Authorization: Bearer <token>`. Each operation lists the scope it needs',
				`(\`x-token-scope\`); token requests are limited to ${apiTokenRateLimit.requests} per minute per token.`,
				'Money is always integer US cents (`*Cents`).',
			].join(' '),
		},
		servers: [{ url: useRuntimeConfig().public.siteUrl.replace(/\/$/, '') }],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					description: 'Personal API token (`rs_…`)',
				},
				sessionCookie: { type: 'apiKey', in: 'cookie', name: 'nuxt-session' },
			},
		},
		paths,
	}
})
