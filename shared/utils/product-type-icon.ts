// One drawn icon per seeded product type (D13); unknown slugs fall back to a generic tag.
const icons: Record<string, string> = {
	electronics: 'i-lucide-headphones',
	'clothing-apparel': 'i-lucide-shirt',
	'home-kitchen': 'i-lucide-coffee',
	books: 'i-lucide-book-open',
	'toys-games': 'i-lucide-dices',
	'sports-outdoors': 'i-lucide-bike',
	ebooks: 'i-lucide-book-marked',
	'software-apps': 'i-lucide-app-window',
	'online-courses': 'i-lucide-graduation-cap',
	'digital-art-design': 'i-lucide-palette',
	'music-audio': 'i-lucide-audio-lines',
	'templates-themes': 'i-lucide-layout-template',
}

export function productTypeIcon(slug: string): string {
	return icons[slug] ?? 'i-lucide-tag'
}
