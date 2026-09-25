import { createHmac, timingSafeEqual } from 'node:crypto'

// D8: a download link is an HMAC over (grant id, expiry), valid for a few minutes. The grant itself
// carries the real limits (download count, 30-day window); the short link TTL only stops a copied
// URL from being reusable later. Links are minted only for the grant's buyer (GET /api/orders/:id).
const linkTtlMs = 10 * 60_000

function sign(grantId: string, expires: number): string {
	const secret = useRuntimeConfig().session.password
	if (!secret) {
		throw createError({ statusCode: 501, statusMessage: 'Downloads are not configured' })
	}
	return createHmac('sha256', secret).update(`download:${grantId}.${expires}`).digest('hex')
}

export function signedDownloadUrl(grantId: string): string {
	const expires = Date.now() + linkTtlMs
	return `/downloads/${grantId}?expires=${expires}&signature=${sign(grantId, expires)}`
}

export function isValidDownloadSignature(
	grantId: string,
	expires: number,
	signature: string,
): boolean {
	if (expires < Date.now()) return false
	return timingSafeEqual(
		Buffer.from(sign(grantId, expires), 'hex'),
		Buffer.from(signature, 'hex'),
	)
}
