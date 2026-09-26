<script setup lang="ts">
import type { CatalogItem } from '#shared/types/catalog'

// Header search with live suggestions (ARIA 1.2 combobox): from 3 characters it shows the top 5
// catalog matches; arrows move, Enter opens the highlighted product (or searches), Esc closes.
const props = defineProps<{ id: string; placeholder: string; compact?: boolean }>()

const MIN_CHARS = 3
const route = useRoute()
const router = useRouter()

const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
watch(
	() => route.query.q,
	(value) => {
		q.value = typeof value === 'string' ? value : ''
	},
)

const results = ref<CatalogItem[]>([])
const total = ref(0)
const status = ref<'idle' | 'loading' | 'done'>('idle')
const open = ref(false)
const active = ref(-1)
const listId = `${props.id}-suggestions`
const term = computed(() => q.value.trim())

let timer: ReturnType<typeof setTimeout> | undefined
let lastRequest = 0
watch(term, (value) => {
	clearTimeout(timer)
	active.value = -1
	if (value.length < MIN_CHARS) {
		status.value = 'idle'
		results.value = []
		return
	}
	status.value = 'loading'
	timer = setTimeout(async () => {
		const request = ++lastRequest
		const response = await $fetch<{ data: CatalogItem[]; meta: { total: number } }>(
			'/api/products',
			{ query: { q: value, perPage: 5 } },
		).catch(() => null)
		// A slower, older response must not overwrite the one for what's typed now.
		if (request !== lastRequest) return
		results.value = response?.data ?? []
		total.value = response?.meta.total ?? 0
		status.value = 'done'
	}, 200)
})

const expanded = computed(() => open.value && term.value.length >= MIN_CHARS)
// Options: the products, then "see all results" (index === results.length); none while empty.
const optionCount = computed(() => (results.value.length ? results.value.length + 1 : 0))
const optionId = (index: number) => `${props.id}-option-${index}`

async function searchAll() {
	open.value = false
	await router.push({ path: '/marketplace', query: term.value ? { q: term.value } : {} })
}

async function choose(index: number) {
	const item = results.value[index]
	open.value = false
	if (item) await router.push(`/products/${item.slug}`)
	else await searchAll()
}

function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		if (expanded.value) event.preventDefault()
		open.value = false
		active.value = -1
		return
	}
	if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
	if (!expanded.value) {
		open.value = true
		return
	}
	event.preventDefault()
	// Cycles input (-1) → options → back to the input.
	const next = active.value + (event.key === 'ArrowDown' ? 1 : -1)
	active.value = next >= optionCount.value ? -1 : next < -1 ? optionCount.value - 1 : next
}

async function onSubmit() {
	if (expanded.value && active.value >= 0) await choose(active.value)
	else await searchAll()
}

// Suggestions close when you leave the search, but not while clicking one of them.
function onFocusout(event: FocusEvent) {
	const next = event.relatedTarget as Node | null
	if (!(event.currentTarget as HTMLElement).contains(next)) open.value = false
}
</script>

<template>
	<search class="relative" @focusout="onFocusout">
		<form class="relative" @submit.prevent="onSubmit">
			<label :for="props.id" class="sr-only">search products</label>
			<span
				v-if="!props.compact"
				class="pointer-events-none absolute inset-y-0 start-5 flex items-center font-mono font-bold text-primary"
				aria-hidden="true"
				>$</span
			>
			<input
				:id="props.id"
				v-model="q"
				type="search"
				name="q"
				role="combobox"
				autocomplete="off"
				aria-autocomplete="list"
				:aria-expanded="expanded"
				:aria-controls="listId"
				:aria-activedescendant="expanded && active >= 0 ? optionId(active) : undefined"
				:placeholder="props.placeholder"
				class="w-full rounded-2xl bg-muted text-base font-medium text-highlighted placeholder:text-dimmed focus:outline-2 focus:outline-primary"
				:class="props.compact ? 'h-11 px-4' : 'h-12 ps-10 pe-12'"
				@focus="open = true"
				@input="open = true"
				@keydown="onKeydown"
			>
			<button
				v-if="!props.compact"
				type="submit"
				class="absolute inset-y-0 end-2 my-auto flex size-9 items-center justify-center rounded-full text-highlighted hover:bg-accented"
				aria-label="search"
			>
				<UIcon name="i-lucide-search" class="size-5" />
			</button>
		</form>

		<div
			v-show="expanded"
			class="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-default bg-default shadow-lg"
		>
			<p v-if="status === 'loading' && !results.length" class="px-4 py-3 text-sm text-muted">
				searching…
			</p>
			<p
				v-else-if="status === 'done' && !results.length"
				class="px-4 py-3 text-sm text-muted"
			>
				no finds for “{{ term }}” yet.
			</p>
			<div :id="listId" role="listbox" aria-label="suggested products">
				<div
					v-for="(item, index) in results"
					:id="optionId(index)"
					:key="item.id"
					role="option"
					tabindex="-1"
					:aria-selected="index === active"
					class="flex cursor-pointer items-center gap-3 px-3 py-2"
					:class="index === active ? 'bg-muted' : 'hover:bg-muted'"
					@mousedown.prevent
					@click="choose(index)"
					@keydown.enter="choose(index)"
					@mousemove="active = index"
				>
					<span class="@container size-10 shrink-0 overflow-hidden rounded-md bg-muted">
						<ProductPhoto
							decorative
							:src="item.coverPath"
							:title="item.title"
							:kind="item.kind"
						/>
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm font-semibold text-highlighted">{{
							item.title
						}}</span>
						<span class="block truncate text-xs text-muted">{{ item.shopName }}</span>
					</span>
					<span class="shrink-0 text-sm font-bold text-highlighted tabular-nums">{{
						formatMoney(item.priceCents)
					}}</span>
				</div>
				<div
					v-if="status === 'done' && results.length"
					:id="optionId(results.length)"
					role="option"
					tabindex="-1"
					:aria-selected="active === results.length"
					class="cursor-pointer border-t border-default px-4 py-2.5 text-sm font-semibold text-primary"
					:class="active === results.length ? 'bg-muted' : 'hover:bg-muted'"
					@mousedown.prevent
					@click="searchAll"
					@keydown.enter="searchAll"
					@mousemove="active = results.length"
				>
					see all {{ total }} {{ total === 1 ? 'find' : 'finds' }} for “{{ term }}” →
				</div>
			</div>
		</div>
	</search>
</template>
