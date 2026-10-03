// nuxt-security's requestSizeLimiter only checks POST, PUT and DELETE (nuxt-security@2.6.0), so a PATCH
// body had no size limit at all (found by the QA fuzz suite, tests/qa/fuzz.spec.ts). Same 2 MB cap.
const MAX_BYTES = 2_000_000

export default defineEventHandler((event) => {
	if (event.method !== 'PATCH') return
	if (Number(getRequestHeader(event, 'content-length') ?? 0) > MAX_BYTES) {
		throw createError({ statusCode: 413, statusMessage: 'Payload Too Large' })
	}
})
