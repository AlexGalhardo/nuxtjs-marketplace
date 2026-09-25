import type { Cart } from '#shared/types/cart'

interface UseCart {
	cart: Ref<Cart | null>
	count: ComputedRef<number>
	refresh: () => Promise<void>
	add: (productId: string, quantity?: number) => Promise<boolean>
	setQuantity: (productId: string, quantity: number) => Promise<void>
	remove: (productId: string) => Promise<void>
}

// One shared cart per app (header badge, product page, /cart). The server response is always the
// source of truth: every mutation returns the re-priced cart (server/utils/cart.ts).
export function useCart(): UseCart {
	const { loggedIn } = useUserSession()
	const route = useRoute()
	const cart = useState<Cart | null>('cart', () => null)
	const count = computed(() => cart.value?.count ?? 0)
	// Forwards the session cookie when the header loads the cart during SSR.
	const requestFetch = useRequestFetch()

	async function refresh() {
		cart.value = loggedIn.value ? await requestFetch<Cart>('/api/cart') : null
	}

	// D2: guests are sent to log in first, then back to where they were.
	async function add(productId: string, quantity = 1) {
		if (!loggedIn.value) {
			await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
			return false
		}
		cart.value = await $fetch<Cart>('/api/cart/items', {
			method: 'POST',
			body: { productId, quantity },
		})
		return true
	}

	async function setQuantity(productId: string, quantity: number) {
		cart.value = await $fetch<Cart>(`/api/cart/items/${productId}`, {
			method: 'PATCH',
			body: { quantity },
		})
	}

	async function remove(productId: string) {
		cart.value = await $fetch<Cart>(`/api/cart/items/${productId}`, { method: 'DELETE' })
	}

	return { cart, count, refresh, add, setQuantity, remove }
}
