// Lowercase, ASCII, hyphen-separated. Uniqueness is enforced at the DB layer (unique column) —
// callers append a short random suffix and retry on conflict (server/utils/slug.ts equivalent
// logic lives at the call site since it needs a DB round-trip).
export function slugify(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}
