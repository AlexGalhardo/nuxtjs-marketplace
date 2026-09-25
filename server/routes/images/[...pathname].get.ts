// Serves only the public `images/` blob prefix. Digital product files live under the private
// `files/` prefix and are never exposed by a route (D8/D9, docs/database.md) — they are only
// readable server-side, served by /downloads/:grantId behind a signed download grant.
export default defineEventHandler(async (event) => {
	const pathname = getRouterParam(event, 'pathname')
	if (!pathname) {
		throw createError({ statusCode: 400, statusMessage: 'Missing image path' })
	}

	return blob.serve(event, `images/${pathname}`)
})
