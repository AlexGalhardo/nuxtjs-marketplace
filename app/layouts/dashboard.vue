<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))

// Placeholder items: /my-shop/** lands in Phase 6, /admin/** in Phase 11. Linking to them
// ahead of the pages matches the incremental phase rollout (PLAN.md §6).
const shopItems: NavigationMenuItem[] = [
	{ label: 'Overview', icon: 'i-lucide-layout-dashboard', to: '/my-shop' },
	{ label: 'Products', icon: 'i-lucide-package', to: '/my-shop/products' },
	{ label: 'Orders', icon: 'i-lucide-receipt', to: '/my-shop/orders' },
	{ label: 'Payouts', icon: 'i-lucide-banknote', to: '/my-shop/payouts' },
	{ label: 'API tokens', icon: 'i-lucide-key', to: '/my-shop/api-tokens' },
	{ label: 'API docs', icon: 'i-lucide-book-open', to: '/my-shop/api-docs' },
	{ label: 'Settings', icon: 'i-lucide-settings', to: '/my-shop/settings' },
]

const adminItems: NavigationMenuItem[] = [
	{ label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/admin' },
	{ label: 'Shops', icon: 'i-lucide-store', to: '/admin/shops' },
	{ label: 'Products', icon: 'i-lucide-package', to: '/admin/products' },
	{ label: 'Users', icon: 'i-lucide-users', to: '/admin/users' },
	{ label: 'Transaction logs', icon: 'i-lucide-scroll-text', to: '/admin/transaction-logs' },
]

const items = computed(() => (isAdmin.value ? adminItems : shopItems))
const panelTitle = computed(() => (isAdmin.value ? 'Admin' : 'My shop'))
</script>

<template>
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
				<UDashboardNavbar :title="panelTitle">
					<template #leading>
						<UDashboardSidebarCollapse />
					</template>
					<template #right>
						<UColorModeButton />
					</template>
				</UDashboardNavbar>
			</template>

			<template #body>
				<slot />
			</template>
		</UDashboardPanel>
	</UDashboardGroup>
</template>
