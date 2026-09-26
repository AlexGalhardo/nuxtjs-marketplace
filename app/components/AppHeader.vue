<script setup lang="ts">
const { loggedIn, user, logout } = useAuth()
const { count: cartCount, refresh: refreshCart } = useCart()
// Not awaited: Nuxt still resolves it during SSR, so the badge ships in the first paint.
useAsyncData('header-cart', () => refreshCart().then(() => true), { watch: [loggedIn] })
const router = useRouter()

const navLinks = [
	{ label: 'physical', to: { path: '/marketplace', query: { kind: 'physical' } } },
	{ label: 'digital', to: { path: '/marketplace', query: { kind: 'digital' } } },
	{ label: 'everything', to: { path: '/marketplace' } },
]

const userMenuItems = computed(() => [
	[
		{ label: 'orders', icon: 'i-lucide-receipt', to: '/orders' },
		{ label: 'profile', icon: 'i-lucide-user', to: '/profile' },
		{ label: 'my shop', icon: 'i-lucide-store', to: '/my-shop' },
		...(user.value?.role === 'admin'
			? [{ label: 'admin', icon: 'i-lucide-shield', to: '/admin' }]
			: []),
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

				<AppSearch
					id="site-search"
					placeholder="search “vintage tee”…"
					class="hidden max-w-md flex-1 md:block"
				/>

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

			<AppSearch
				id="site-search-mobile"
				placeholder="$ search “vintage tee”…"
				compact
				class="rs-container pb-3 md:hidden"
			/>
		</header>
	</div>
</template>
