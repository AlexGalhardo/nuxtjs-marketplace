// Filter state mirrored in the query string (shareable, survives reload and back/forward). Only
// non-default values go in the URL; any filter change except `page` sends you back to page 1.
export function useUrlFilters<T extends Record<string, string | number>>(defaults: T): T {
	const route = useRoute()
	const router = useRouter()
	const filters = reactive({ ...defaults }) as T

	function readQuery() {
		for (const [key, fallback] of Object.entries(defaults)) {
			const raw = route.query[key]
			;(filters as Record<string, string | number>)[key] =
				typeof raw !== 'string'
					? fallback
					: typeof fallback === 'number'
						? Number(raw) || fallback
						: raw
		}
	}
	readQuery()
	watch(() => route.query, readQuery)

	watch(
		() => ({ ...filters }),
		(next, previous) => {
			const changedOtherThanPage = Object.keys(defaults).some(
				(key) => key !== 'page' && next[key] !== previous[key],
			)
			if (changedOtherThanPage && 'page' in filters && filters.page !== 1) {
				;(filters as Record<string, string | number>).page = 1
				return
			}
			const query = Object.fromEntries(
				Object.entries(filters)
					.filter(([key, value]) => value !== defaults[key] && value !== '')
					.map(([key, value]) => [key, String(value)]),
			)
			router.replace({ query })
		},
	)
	return filters
}
