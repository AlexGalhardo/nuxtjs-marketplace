// Stored image paths are blob keys ("images/..." served by server/routes/images) — or, for the fake
// seed catalog only, absolute placeholder URLs (picsum.photos, allowed in the CSP img-src).
export function mediaUrl(path: string): string {
	return /^https?:\/\//.test(path) ? path : `/${path}`
}
