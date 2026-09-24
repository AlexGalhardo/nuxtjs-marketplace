import { catalogQuerySchema } from '#shared/schemas/catalog'

// GET /api/products — public catalog with filters (PLAN.md Phase 7). Query: docs/rest-api.md.
export default defineEventHandler(async (event) => {
	const query = await getValidatedQuery(event, catalogQuerySchema.parse)
	return searchCatalog(query)
})
