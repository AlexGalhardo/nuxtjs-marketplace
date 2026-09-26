// Serves only the public `images/` blob prefix. Digital product files live under the private
// `files/` prefix and are never exposed by a route (D8/D9, docs/database.md) — they are only
// readable server-side, served by /downloads/:grantId behind a signed download grant.
export default defineEventHandler(async (event) => {
	const pathname = getRouterParam(event, 'pathname', { decode: true })
	// The router hands over encoded separators (`..%2F`, `%2e%2e%5c`) undecoded, and the blob layer
	// decodes again, so `images/..%2Ffiles/…` (or double-encoded) used to serve paid files to anyone.
	// Our image paths are slug-safe, so any `%` left after one decode is an attack.
	if (
		!pathname ||
		/[\\%]/.test(pathname) ||
		pathname.split('/').some((s) => s === '..' || s === '.')
	) {
		throw createError({ statusCode: 404, statusMessage: 'Image not found' })
	}

	// Keys carry a random suffix and are never overwritten (a new upload gets a new key).
	setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
	return blob.serve(event, `images/${pathname}`)
})
