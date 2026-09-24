<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

// Enjoei's row header: heading, a short line with personality under it, a link on the right.
defineProps<{
	title: string
	subtitle?: string
	to?: RouteLocationRaw
	linkLabel?: string
	headingId?: string
}>()
</script>

<template>
	<div class="mb-5 flex items-end justify-between gap-4">
		<div>
			<h2
				:id="headingId"
				class="text-2xl font-semibold text-highlighted sm:text-[2rem] sm:leading-10"
			>
				{{ title }}
			</h2>
			<p v-if="subtitle" class="mt-1 font-medium text-muted">{{ subtitle }}</p>
		</div>
		<NuxtLink
			v-if="to"
			:to="to"
			class="shrink-0 font-bold text-primary hover:underline underline-offset-4"
		>
			{{ linkLabel ?? 'see all' }}
		</NuxtLink>
	</div>
</template>
