<script setup lang="ts">
import type { CatalogItem } from '#shared/types/catalog'

// Enjoei's row mosaic: big, two stacked, big, two stacked. Price rides on the photo.
const props = defineProps<{ items: CatalogItem[] }>()

// Slots 0 and 3 are the big squares; the others stack in pairs beside them.
const big = (index: number) => index === 0 || index === 3
</script>

<template>
	<ul class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-[2fr_1fr_2fr_1fr] md:grid-rows-2">
		<li
			v-for="(item, index) in props.items.slice(0, 6)"
			:key="item.id"
			:class="big(index) && 'md:row-span-2'"
		>
			<NuxtLink
				:to="`/products/${item.slug}`"
				class="group @container relative block aspect-square overflow-hidden rounded-lg bg-muted"
			>
				<ProductPhoto
					decorative
					:src="item.coverPath"
					:title="item.title"
					:kind="item.kind"
					class="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
				/>
				<span
					class="absolute start-2 bottom-2 rounded bg-default px-2 py-1 text-xs font-bold text-highlighted tabular-nums"
				>
					{{ formatMoney(item.priceCents) }}
				</span>
				<span class="sr-only">{{ item.title }}</span>
			</NuxtLink>
		</li>
	</ul>
</template>
