<script setup lang="ts">
import type { ProductType } from '#shared/types/db'

const { loggedIn } = useAuth()
const { version } = useAppConfig()
const { data: productTypes } = await useFetch<ProductType[]>('/api/product-types', {
	key: 'product-types',
	default: () => [],
})

const columns = computed(() => [
	{
		title: 'browse',
		links: [
			{ label: 'everything', to: '/marketplace' },
			...productTypes.value.map((type) => ({
				label: type.name,
				to: `/marketplace?type=${type.slug}`,
			})),
		],
	},
	{
		title: 'sell',
		links: [
			{ label: 'open your shop', to: '/my-shop' },
			{ label: 'your products', to: '/my-shop/products' },
			{ label: 'payouts', to: '/my-shop/payouts' },
		],
	},
	{
		title: 'help',
		links: [
			{ label: 'talk to us', to: '/contact' },
			{ label: 'terms', to: '/terms' },
			{ label: 'privacy', to: '/privacy' },
			{ label: 'system design', to: '/system-design' },
		],
	},
	{
		title: 'you',
		links: loggedIn.value
			? [
					{ label: 'profile', to: '/profile' },
					{ label: 'my shop', to: '/my-shop' },
				]
			: [
					{ label: 'log in', to: '/login' },
					{ label: 'create account', to: '/signup' },
				],
	},
])
</script>

<template>
	<footer class="mt-24 border-t border-default">
		<div class="rs-container py-12">
			<div class="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
				<nav
					v-for="column in columns"
					:key="column.title"
					:aria-label="column.title"
					:class="column.title === 'browse' && 'col-span-2 md:col-span-1'"
				>
					<h2 class="mb-4 font-bold text-highlighted">{{ column.title }}</h2>
					<ul
						class="space-y-2"
						:class="column.title === 'browse' && 'columns-2 gap-6 md:columns-1'"
					>
						<li v-for="link in column.links" :key="link.label">
							<NuxtLink :to="link.to" class="text-sm text-toned hover:text-primary">{{
								link.label
							}}</NuxtLink>
						</li>
					</ul>
				</nav>
			</div>

			<p class="mt-12 max-w-3xl border-t border-default pt-8 text-sm text-muted">
				resell.sh is a marketplace for things you already own and things you make: clothes,
				gear, presets, templates, e-books. one cart, one checkout, every seller paid out
				through stripe.
			</p>

			<div
				class="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-default pt-6"
			>
				<AppLogo />
				<p class="text-xs text-muted">
					resell.sh © {{ new Date().getFullYear() }} · an open-source learning project ·
					<a
						:href="`https://github.com/AlexGalhardo/nuxtjs-marketplace/releases/tag/v${version}`"
						class="font-mono hover:text-primary"
						>v{{ version }}</a
					>
				</p>
			</div>
		</div>
	</footer>
</template>
