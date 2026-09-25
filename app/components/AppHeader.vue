<script setup lang="ts">
const { loggedIn, user, logout } = useAuth()
const { count: cartCount, refresh: refreshCart } = useCart()
// Not awaited: Nuxt still resolves it during SSR, so the badge ships in the first paint.
useAsyncData('header-cart', () => refreshCart().then(() => true), { watch: [loggedIn] })
const route = useRoute()
const router = useRouter()

const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
watch(
	() => route.query.q,
	(value) => {
		q.value = typeof value === 'string' ? value : ''
	},
)

async function search() {
	await router.push({ path: '/marketplace', query: q.value.trim() ? { q: q.value.trim() } : {} })
}

const navLinks = [
	{ label: 'physical', to: { path: '/marketplace', query: { kind: 'physical' } } },
	{ label: 'digital', to: { path: '/marketplace', query: { kind: 'digital' } } },
	{ label: 'everything', to: { path: '/marketplace' } },
]

const userMenuItems = computed(() => [
	[
		{ label: 'profile', icon: 'i-lucide-user', to: '/profile' },
		{ label: 'my shop', icon: 'i-lucide-store', to: '/my-shop' },
	],
	[
		{
			label: 'log out',
			icon: 'i-lucide-log-out',
			onSelect: async () => {
				await logout()
				await router.push('/')
			},
		},
	],
])
</script>

<template>
	<div class="sticky top-0 z-40 bg-default">
		<p class="bg-(--rs-signal) py-1.5 text-center text-sm font-semibold text-(--rs-signal-ink)">
			list for free. we only take 10% when it sells.
		</p>

		<header class="border-b border-default">
			<div class="rs-container flex h-(--ui-header-height) items-center gap-4 lg:gap-6">
				<NuxtLink to="/" class="shrink-0 rounded-md" aria-label="resell.sh home">
					<AppLogo />
				</NuxtLink>

				<search class="hidden max-w-md flex-1 md:block">
					<form class="relative" @submit.prevent="search">
						<label for="site-search" class="sr-only">search products</label>
						<span
							class="pointer-events-none absolute inset-y-0 start-5 flex items-center font-mono font-bold text-primary"
							aria-hidden="true"
							>$</span
						>
						<input
							id="site-search"
							v-model="q"
							type="search"
							name="q"
							autocomplete="off"
							placeholder="search “vintage tee”"
							class="h-12 w-full rounded-2xl bg-muted ps-10 pe-12 text-base font-medium text-highlighted placeholder:text-dimmed focus:outline-2 focus:outline-primary"
						>
						<button
							type="submit"
							class="absolute inset-y-0 end-2 my-auto flex size-9 items-center justify-center rounded-full text-highlighted hover:bg-accented"
							aria-label="search"
						>
							<UIcon name="i-lucide-search" class="size-5" />
						</button>
					</form>
				</search>

				<nav aria-label="shop by kind" class="ms-auto hidden items-center gap-5 lg:flex">
					<NuxtLink
						v-for="link in navLinks"
						:key="link.label"
						:to="link.to"
						class="text-[0.95rem] font-semibold text-highlighted hover:text-primary"
					>
						{{ link.label }}
					</NuxtLink>
				</nav>

				<div
					class="ms-auto flex items-center gap-1 lg:ms-0 lg:border-s lg:border-default lg:ps-4"
				>
					<UButton
						to="/contact"
						icon="i-lucide-circle-help"
						color="neutral"
						variant="ghost"
						aria-label="help and contact"
						class="hidden sm:inline-flex"
					/>
					<UColorModeButton />
					<NuxtLink
						to="/cart"
						class="relative flex size-9 items-center justify-center rounded-full text-highlighted hover:bg-muted"
						:aria-label="cartCount ? `cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}` : 'cart'"
					>
						<UIcon name="i-lucide-shopping-bag" class="size-5" />
						<span
							v-if="cartCount"
							class="absolute -end-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-(--rs-signal) px-1 text-[0.7rem] leading-none font-bold text-(--rs-signal-ink) tabular-nums"
							aria-hidden="true"
							>{{
								cartCount > 99 ? '99+' : cartCount
							}}</span
						>
					</NuxtLink>
					<UDropdownMenu v-if="loggedIn" :items="userMenuItems">
						<UButton
							:label="user?.name"
							trailing-icon="i-lucide-chevron-down"
							color="neutral"
							variant="ghost"
							icon="i-lucide-circle-user"
							:aria-label="user?.name"
							:ui="{
								leadingIcon: 'sm:hidden',
								label: 'hidden max-w-40 truncate sm:block',
								trailingIcon: 'hidden sm:inline-flex',
							}"
						/>
					</UDropdownMenu>
					<NuxtLink
						v-else
						to="/login"
						class="px-2 font-semibold text-highlighted hover:text-primary"
						>log in</NuxtLink
					>
					<UButton to="/my-shop" size="lg" class="ms-1 hidden sm:inline-flex"
						>start selling</UButton
					>
				</div>
			</div>

			<search class="rs-container pb-3 md:hidden">
				<form @submit.prevent="search">
					<label for="site-search-mobile" class="sr-only">search products</label>
					<input
						id="site-search-mobile"
						v-model="q"
						type="search"
						name="q"
						autocomplete="off"
						placeholder="$ search “vintage tee”"
						class="h-11 w-full rounded-2xl bg-muted px-4 text-base font-medium text-highlighted placeholder:text-dimmed focus:outline-2 focus:outline-primary"
					>
				</form>
			</search>
		</header>
	</div>
</template>
