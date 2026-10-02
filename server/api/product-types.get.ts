// Public, read-only: proves the DB layer (Phase 3) works end-to-end. The full catalog/filters
// endpoint (GET /api/products) lands in Phase 7.
export default defineCachedEventHandler(async () => {
	return db.select().from(schema.productTypes).orderBy(schema.productTypes.slug)
}, catalogCache)
