import { z } from 'zod'

export const catalogSorts = ['newest', 'price-asc', 'price-desc'] as const
export type CatalogSort = (typeof catalogSorts)[number]

// Query string for GET /api/products and /marketplace. Prices are whole dollars in the URL
// (readable, shareable); the server converts to cents before querying.
export const catalogQuerySchema = z
	.object({
		q: z.string().trim().max(100).optional(),
		kind: z.enum(['physical', 'digital']).optional(),
		type: z.string().trim().max(60).optional(),
		shop: z.string().trim().max(60).optional(),
		minPrice: z.coerce.number().int().min(0).max(1_000_000).optional(),
		maxPrice: z.coerce.number().int().min(0).max(1_000_000).optional(),
		sort: z.enum(catalogSorts).default('newest'),
		page: z.coerce.number().int().min(1).default(1),
		perPage: z.coerce.number().int().min(1).max(48).default(24),
	})
	.refine(
		(query) =>
			query.minPrice === undefined ||
			query.maxPrice === undefined ||
			query.minPrice <= query.maxPrice,
		{
			message: 'Min price must be less than or equal to max price',
			path: ['minPrice'],
		},
	)

export type CatalogQuery = z.infer<typeof catalogQuerySchema>
