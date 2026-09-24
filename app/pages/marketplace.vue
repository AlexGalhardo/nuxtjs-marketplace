<script setup lang="ts">
import { type CatalogQuery, catalogQuerySchema } from '#shared/schemas/catalog'
import type { CatalogItem } from '#shared/types/catalog'
import type { ProductType } from '#shared/types/db'

const route = useRoute()
const router = useRouter()

// The URL is the state: every filter is a query param, so results are shareable and back/forward
// just works. Invalid params fall back to defaults instead of erroring the page.
const query = computed<CatalogQuery>(() => {
	const parsed = catalogQuerySchema.safeParse(route.query)
	return parsed.success ? parsed.data : catalogQuerySchema.parse({})
})

type Page = { data: CatalogItem[]; meta: { page: number; perPage: number; total: number } }
const { data: results, status } = await useFetch<Page>('/api/products', { query })
const { data: productTypes } = await useFetch<ProductType[]>('/api/product-types', {
	key: 'product-types',
	default: () => [],
})

function setFilters(patch: Partial<Record<keyof CatalogQuery, string | number | undefined>>) {
	const next: Record<string, string> = {}
	for (const [key, value] of Object.entries({ ...route.query, page: undefined, ...patch })) {
		if (value !== undefined && value !== null && value !== '') next[key] = String(value)
	}
	return router.push({ query: next })
}

const activeType = computed(() => productTypes.value.find((type) => type.slug === query.value.type))
const heading = computed(() => {
	if (query.value.q) return `“${query.value.q}”`
	if (activeType.value) return activeType.value.name
	if (query.value.shop) return query.value.shop
	return query.value.kind ?? 'everything'
})
useSeoMeta({ title: () => `${heading.value} — resell.sh` })

const total = computed(() => results.value?.meta.total ?? 0)
const hasFilters = computed(() =>
	['q', 'kind', 'type', 'minPrice', 'maxPrice', 'shop'].some(
		(key) => route.query[key] !== undefined,
	),
)

const kinds = [
	{ label: 'everything', value: undefined, icon: 'i-lucide-infinity' },
	{ label: 'physical', value: 'physical', icon: 'i-lucide-package' },
	{ label: 'digital', value: 'digital', icon: 'i-lucide-download' },
] as const

const sortItems = [
	{ label: 'newest first', value: 'newest' },
	{ label: 'price: low to high', value: 'price-asc' },
	{ label: 'price: high to low', value: 'price-desc' },
]
const typeItems = computed(() =>
	productTypes.value
		.filter((type) => !query.value.kind || type.kind === query.value.kind)
		.map((type) => ({ label: type.name, value: type.slug, icon: productTypeIcon(type.slug) })),
)

const minPrice = ref<number | undefined>(query.value.minPrice)
const maxPrice = ref<number | undefined>(query.value.maxPrice)
const priceOpen = ref(false)
watch(query, (value) => {
	minPrice.value = value.minPrice
	maxPrice.value = value.maxPrice
})
const priceLabel = computed(() => {
	const { minPrice: min, maxPrice: max } = query.value
	if (min !== undefined && max !== undefined) return `$${min} – $${max}`
	if (min !== undefined) return `from $${min}`
	if (max !== undefined) return `up to $${max}`
	return 'price'
})
async function applyPrice() {
	priceOpen.value = false
	await setFilters({
		minPrice: minPrice.value || undefined,
		maxPrice: maxPrice.value || undefined,
	})
}

const pill =
	'h-10 rounded-xl px-3 text-sm font-semibold ring-1 ring-default hover:bg-muted data-[active=true]:bg-(--rs-selected) data-[active=true]:text-(--rs-selected-ink) data-[active=true]:ring-transparent'
</script>

<template>
	<div class="rs-container py-6">
		<UBreadcrumb
			:items="[{ label: 'home', to: '/' }, { label: heading }]"
			class="mb-4"
			:ui="{ link: 'text-base font-medium' }"
		/>

		<div class="flex flex-wrap items-end justify-between gap-2">
			<h1 class="text-[2rem] leading-10 font-semibold text-highlighted">{{ heading }}</h1>
			<p class="font-medium text-muted tabular-nums" aria-live="polite">
				{{ total.toLocaleString('en-US') }} {{ total === 1 ? 'find' : 'finds' }}
			</p>
		</div>

		<ul class="mt-5 flex gap-3" aria-label="kind">
			<li v-for="kind in kinds" :key="kind.label">
				<button
					type="button"
					class="flex h-12 items-center gap-2 rounded-full px-4 font-bold ring-1 ring-default hover:bg-muted data-[active=true]:bg-primary data-[active=true]:text-inverted data-[active=true]:ring-transparent"
					:data-active="query.kind === kind.value"
					:aria-pressed="query.kind === kind.value"
					@click="setFilters({ kind: kind.value, type: undefined })"
				>
					<UIcon :name="kind.icon" class="size-5" />
					{{ kind.label }}
				</button>
			</li>
		</ul>

		<div class="-mx-6 mt-4 flex gap-2 overflow-x-auto border-b border-default px-6 pb-4">
			<USelect
				:model-value="query.sort"
				:items="sortItems"
				aria-label="sort"
				:class="pill"
				data-active="true"
				variant="none"
				@update:model-value="(sort) => setFilters({ sort: sort === 'newest' ? undefined : String(sort) })"
			/>
			<USelectMenu
				:model-value="query.type"
				:items="typeItems"
				value-key="value"
				placeholder="type"
				aria-label="product type"
				:search-input="{ placeholder: 'filter types…' }"
				:class="pill"
				:data-active="Boolean(query.type)"
				variant="none"
				@update:model-value="(type) => setFilters({ type: type ?? undefined })"
			/>
			<UPopover v-model:open="priceOpen">
				<button
					type="button"
					:class="[pill, 'flex shrink-0 items-center gap-1']"
					:data-active="priceLabel !== 'price'"
				>
					{{ priceLabel }}
					<UIcon name="i-lucide-chevron-down" class="size-4" />
				</button>
				<template #content>
					<form class="flex w-64 flex-col gap-3 p-4" @submit.prevent="applyPrice">
						<p class="font-bold text-highlighted">price in usd</p>
						<div class="flex items-center gap-2">
							<UFormField label="min" class="flex-1">
								<UInput
									v-model.number="minPrice"
									type="number"
									min="0"
									inputmode="numeric"
									placeholder="0"
								/>
							</UFormField>
							<UFormField label="max" class="flex-1">
								<UInput
									v-model.number="maxPrice"
									type="number"
									min="0"
									inputmode="numeric"
									placeholder="any"
								/>
							</UFormField>
						</div>
						<UButton type="submit" block>show results</UButton>
					</form>
				</template>
			</UPopover>
			<button
				v-if="hasFilters"
				type="button"
				class="shrink-0 px-3 text-sm font-bold text-primary hover:underline underline-offset-4"
				@click="router.push({ query: {} })"
			>
				clear filters
			</button>
		</div>

		<div
			v-if="status === 'pending' && !results"
			class="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
		>
			<USkeleton v-for="n in 10" :key="n" class="aspect-square rounded-lg" />
		</div>

		<ul
			v-else-if="results?.data.length"
			class="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
			:class="status === 'pending' && 'opacity-60'"
		>
			<li v-for="(item, index) in results.data" :key="item.id">
				<ProductCard :item="item" :eager="index < 5" />
			</li>
		</ul>

		<div v-else class="mt-10 rounded-xl bg-muted px-6 py-16 text-center">
			<UIcon name="i-lucide-search-x" class="size-10 text-dimmed" />
			<p class="mt-3 text-xl font-semibold text-highlighted">no finds for that combo</p>
			<p class="mt-1 text-muted">try a shorter search, or loosen the price range.</p>
			<UButton class="mt-6" variant="outline" @click="router.push({ query: {} })"
				>see everything</UButton
			>
		</div>

		<UPagination
			v-if="total > query.perPage"
			:page="query.page"
			:total="total"
			:items-per-page="query.perPage"
			class="mt-12 flex justify-center"
			@update:page="(page) => setFilters({ page: page === 1 ? undefined : page })"
		/>
	</div>
</template>
