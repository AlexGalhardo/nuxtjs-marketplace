<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// The seller area lives inside the regular site (header, search, footer): it's the same world,
// just busier (PRODUCT.md principle 4). Only the section nav is added.
const items: NavigationMenuItem[] = [
	{ label: 'overview', icon: 'i-lucide-layout-dashboard', to: '/my-shop', exact: true },
	{ label: 'products', icon: 'i-lucide-package', to: '/my-shop/products' },
	{ label: 'orders', icon: 'i-lucide-receipt', to: '/my-shop/orders' },
	{ label: 'payouts', icon: 'i-lucide-banknote', to: '/my-shop/payouts' },
	{ label: 'api tokens', icon: 'i-lucide-key', to: '/my-shop/api-tokens' },
	{ label: 'api docs', icon: 'i-lucide-book-open', to: '/my-shop/api-docs' },
	{ label: 'settings', icon: 'i-lucide-settings', to: '/my-shop/settings' },
]
</script>

<template>
	<NuxtLayout name="default">
		<div class="rs-container lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
			<nav aria-label="my shop" class="border-b border-default py-3 lg:border-b-0 lg:py-10">
				<p
					class="mb-2 hidden px-2.5 text-xs font-semibold tracking-wide text-muted lg:block"
				>
					my shop
				</p>
				<UNavigationMenu
					:items="items"
					orientation="horizontal"
					class="-mx-2 overflow-x-auto lg:hidden"
				/>
				<UNavigationMenu
					:items="items"
					orientation="vertical"
					class="hidden lg:flex lg:sticky lg:top-40"
				/>
			</nav>
			<div class="min-w-0">
				<slot />
			</div>
		</div>
	</NuxtLayout>
</template>
