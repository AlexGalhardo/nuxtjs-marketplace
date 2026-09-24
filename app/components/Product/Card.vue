<script setup lang="ts">
import type { CatalogItem } from '#shared/types/catalog'

const props = defineProps<{ item: CatalogItem; eager?: boolean }>()
const soldOut = computed(() => props.item.kind === 'physical' && props.item.stock === 0)
</script>

<template>
	<NuxtLink :to="`/products/${props.item.slug}`" class="group block rounded-lg">
		<div class="@container relative aspect-square overflow-hidden rounded-lg bg-muted">
			<ProductPhoto
				:src="props.item.coverPath"
				:title="props.item.title"
				:kind="props.item.kind"
				:eager="props.eager"
				class="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
			/>
			<span
				v-if="soldOut"
				class="absolute start-2 bottom-2 rounded bg-default px-2 py-1 text-xs font-bold text-highlighted"
				>sold out</span
			>
			<span
				v-else-if="props.item.kind === 'digital'"
				class="absolute start-2 bottom-2 rounded bg-(--rs-signal) px-2 py-1 text-xs font-bold text-(--rs-signal-ink)"
				>instant download</span
			>
		</div>
		<p class="mt-2 font-bold text-highlighted tabular-nums">
			{{ formatMoney(props.item.priceCents) }}
		</p>
		<p class="truncate text-sm font-medium text-toned group-hover:text-primary">
			{{ props.item.title }}
		</p>
		<p class="truncate text-sm text-muted">
			{{ props.item.shopName }} • {{ props.item.typeName }}
		</p>
	</NuxtLink>
</template>
