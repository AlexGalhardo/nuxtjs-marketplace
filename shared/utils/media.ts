import { slugify } from './slug'

// Stored image paths are blob keys ("images/..." served by server/routes/images) or bundled demo
// photos ("seed/...", public/seed). Absolute URLs pass through untouched.
export function mediaUrl(path: string): string {
	return /^https?:\/\//.test(path) ? path : `/${path}`
}

// Storage key for an uploaded file. NuxtHub's blob.put() keeps the client's filename verbatim
// (after decodeURIComponent), so `../` in it escaped the upload prefix and a `%` crashed the upload.
export function blobFileName(name: string): string {
	const dot = name.lastIndexOf('.')
	const base = slugify(dot >= 0 ? name.slice(0, dot) : name) || 'file'
	const ext = dot >= 0 ? slugify(name.slice(dot + 1)) : ''
	return ext ? `${base}.${ext}` : base
}
