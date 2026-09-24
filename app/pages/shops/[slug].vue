<script setup lang="ts">
import type { CatalogItem } from '#shared/types/catalog'

interface PublicShop {
	id: string
	slug: string
	name: string
	description: string | null
	logoPath: string | null
	bannerPath: string | null
	createdAt: string
}

const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.slug))

const { data: shop, error } = await useFetch<PublicShop>(() => `/api/shops/${slug.value}`)
if (error.value || !shop.value) {
	throw createError({ statusCode: 404, statusMessage: 'Shop not found', fatal: true })
}
const store = computed(() => shop.value as PublicShop)

const page = computed(() => Math.max(1, Number(route.query.page) || 1))
type Page = { data: CatalogItem[]; meta: { page: number; perPage: number; total: number } }
const { data: results } = await useFetch<Page>('/api/products', {
	query: computed(() => ({ shop: slug.value, page: page.value })),
})
const total = computed(() => results.value?.meta.total ?? 0)

const since = computed(() =>
	new Date(store.value.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
)

useSeoMeta({
	title: () => store.value.name,
	description: () => store.value.description ?? `${store.value.name} on resell.sh`,
})
</script>

<template>
	<div class="rs-container py-6">
		<div class="overflow-hidden rounded-xl bg-(--rs-selected)">
			<img
				v-if="store.bannerPath"
				:src="mediaUrl(store.bannerPath)"
				alt=""
				width="1200"
				height="300"
				class="aspect-[4/1] w-full object-cover"
			>
			<div v-else class="aspect-[6/1] w-full" />
		</div>

		<div class="flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:px-6">
			<img
				v-if="store.logoPath"
				:src="mediaUrl(store.logoPath)"
				alt=""
				width="112"
				height="112"
				class="-mt-12 size-24 shrink-0 rounded-full object-cover ring-4 ring-(--ui-bg) sm:-mt-14 sm:size-28"
			>
			<span
				v-else
				class="-mt-12 flex size-24 shrink-0 items-center justify-center rounded-full bg-ink-950 font-display text-5xl font-black text-matrix-400 ring-4 ring-(--ui-bg) sm:-mt-14 sm:size-28"
				aria-hidden="true"
				>{{
					store.name.charAt(0)
				}}</span
			>
			<div class="min-w-0 flex-1">
				<h1 class="text-[2rem] leading-10 font-semibold text-balance text-highlighted">
					{{ store.name }}
				</h1>
				<p class="mt-1 font-medium text-muted">
					<span class="font-mono">/{{ store.slug }}</span>
					· selling since {{ since }} ·
					<span class="tabular-nums">{{ total }}</span>
					{{ total === 1 ? 'listing' : 'listings' }}
				</p>
			</div>
		</div>

		<p
			v-if="store.description"
			class="mt-6 max-w-prose whitespace-pre-line px-2 text-toned sm:px-6"
		>
			{{ store.description }}
		</p>

		<ul
			v-if="results?.data.length"
			class="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 border-t border-default pt-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
		>
			<li v-for="(item, index) in results.data" :key="item.id">
				<ProductCard :item="item" :eager="index < 5" />
			</li>
		</ul>
		<div v-else class="mt-10 rounded-xl bg-muted px-6 py-16 text-center">
			<UIcon name="i-lucide-store" class="size-10 text-dimmed" />
			<p class="mt-3 text-xl font-semibold text-highlighted">shelves are empty</p>
			<p class="mt-1 text-muted">nothing listed here right now. check back soon.</p>
			<UButton class="mt-6" variant="outline" to="/marketplace">browse everything</UButton>
		</div>

		<UPagination
			v-if="results && total > results.meta.perPage"
			:page="page"
			:total="total"
			:items-per-page="results.meta.perPage"
			class="mt-12 flex justify-center"
			@update:page="(next) => router.push({ query: next === 1 ? {} : { page: String(next) } })"
		/>
	</div>
</template>
