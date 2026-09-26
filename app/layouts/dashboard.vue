<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Admin area only; the seller area uses the site layout (layouts/my-shop.vue).
const items: NavigationMenuItem[] = [
	{ label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/admin' },
	{ label: 'Shops', icon: 'i-lucide-store', to: '/admin/shops' },
	{ label: 'Products', icon: 'i-lucide-package', to: '/admin/products' },
	{ label: 'Users', icon: 'i-lucide-users', to: '/admin/users' },
	{ label: 'Transaction logs', icon: 'i-lucide-scroll-text', to: '/admin/transaction-logs' },
]
</script>

<template>
	<a
		href="#main"
		class="sr-only z-50 rounded-full bg-primary px-4 py-2 font-bold text-inverted focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
	>
		skip to content
	</a>
	<UDashboardGroup>
		<UDashboardSidebar collapsible resizable>
			<template #header="{ collapsed }">
				<NuxtLink
					to="/"
					class="flex items-center"
					:aria-label="collapsed ? 'Marketplace' : undefined"
				>
					<AppLogo v-if="!collapsed" class="w-auto h-6 shrink-0" />
					<UIcon
						v-else
						name="i-lucide-store"
						class="size-5 text-primary"
						aria-hidden="true"
					/>
				</NuxtLink>
			</template>

			<template #default="{ collapsed }">
				<UNavigationMenu :collapsed="collapsed" :items="items" orientation="vertical" />
			</template>

			<template #footer="{ collapsed }">
				<UButton
					to="/"
					:label="collapsed ? undefined : 'Back to marketplace'"
					:aria-label="collapsed ? 'Back to marketplace' : undefined"
					icon="i-lucide-arrow-left"
					color="neutral"
					variant="ghost"
					block
					:square="collapsed"
				/>
			</template>
		</UDashboardSidebar>

		<UDashboardPanel>
			<template #header>
				<!-- No `title` prop: it renders an <h1>, and every page brings its own. -->
				<UDashboardNavbar>
					<template #leading>
						<UDashboardSidebarCollapse />
						<span class="font-semibold text-highlighted">Admin</span>
					</template>
					<template #right>
						<UColorModeButton />
					</template>
				</UDashboardNavbar>
			</template>

			<template #body>
				<main id="main" class="contents">
					<slot />
				</main>
			</template>
		</UDashboardPanel>
	</UDashboardGroup>
</template>
