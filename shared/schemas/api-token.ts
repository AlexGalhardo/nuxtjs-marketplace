import { z } from 'zod'

// D14: what a personal API token may do on /api/v1/shop/**. Read = GET, write = everything else.
export const apiTokenScopes = [
	'shop:read',
	'shop:write',
	'products:read',
	'products:write',
	'orders:read',
	'orders:write',
] as const
export type ApiTokenScope = (typeof apiTokenScopes)[number]

export const createApiTokenSchema = z.object({
	name: z.string().trim().min(1, 'Name the token').max(60),
	scopes: z.array(z.enum(apiTokenScopes)).min(1, 'Pick at least one scope'),
	// null = never expires.
	expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]).default(90),
})

export type CreateApiTokenInput = z.input<typeof createApiTokenSchema>
