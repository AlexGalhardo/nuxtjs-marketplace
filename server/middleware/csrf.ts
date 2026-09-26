// CSRF defense in depth (OWASP A01): the session cookie is already SameSite=Lax, and every
// cookie-authenticated mutation must also come from our own origin. Browsers always send Origin
// (or at least Referer) on cross-site POSTs; clients that send neither aren't browsers, so they
// can't carry a victim's cookies. Bearer-token calls and the signed Stripe webhook use no cookies.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
	if (SAFE_METHODS.has(event.method) || !event.path.startsWith('/api/')) return
	if (event.path.startsWith('/api/stripe/webhook')) return
	if (getHeader(event, 'authorization')?.startsWith('Bearer ')) return

	const source = getHeader(event, 'origin') ?? getHeader(event, 'referer')
	if (!source) return
	let sourceHost: string | undefined
	try {
		sourceHost = new URL(source).host
	} catch {}
	if (sourceHost !== getRequestHost(event, { xForwardedHost: true })) {
		logSecurityEvent(event, 'csrf.refused', { path: event.path, origin: source })
		throw createError({ statusCode: 403, statusMessage: 'Cross-site request refused' })
	}
})
