<script setup lang="ts">
import type { ProductKind } from '#shared/types/enums'

// A product image, or — when the seller hasn't uploaded one yet — a typographic tile in the
// product's own words (Enjoei's campaign-lettering, not a grey "no image" box).
const props = defineProps<{
	src: string | null
	title: string
	kind: ProductKind
	alt?: string | null
	eager?: boolean
	// Set when the surrounding link already names the product, so it isn't announced twice.
	decorative?: boolean
}>()
</script>

<template>
	<img
		v-if="props.src"
		:src="mediaUrl(props.src)"
		:alt="props.decorative ? '' : props.alt || props.title"
		:loading="props.eager ? 'eager' : 'lazy'"
		width="600"
		height="600"
		class="size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
	>
	<div
		v-else
		:role="props.decorative ? undefined : 'img'"
		:aria-label="props.decorative ? undefined : `${props.title} (no photo yet)`"
		:aria-hidden="props.decorative || undefined"
		class="flex size-full flex-col justify-between p-[8%]"
		:class="props.kind === 'digital' ? 'bg-ink-950 text-matrix-400' : 'bg-(--rs-selected) text-(--rs-selected-ink)'"
	>
		<UIcon
			:name="props.kind === 'digital' ? 'i-lucide-download' : 'i-lucide-package'"
			class="size-[14%] opacity-80"
		/>
		<span
			class="line-clamp-4 font-display text-[clamp(1.25rem,9cqw,3.5rem)] leading-[0.9] font-black"
		>
			{{ props.title }}
		</span>
	</div>
</template>
