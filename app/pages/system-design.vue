<script setup lang="ts">
useSeoMeta({
	title: 'System design — resell.sh',
	description:
		'Interactive diagrams of how resell.sh, an open-source marketplace, is built: architecture, money flow, data model, scaling and observability.',
})

const docsUrl = 'https://github.com/AlexGalhardo/nuxtjs-marketplace/blob/main/docs/system-design/'

const legend = [
	{ label: 'our code', class: 'rs-flow-node--app' },
	{ label: 'where data lives', class: 'rs-flow-node--store' },
	{ label: 'third party', class: '' },
	{ label: 'people and browsers', class: 'rs-flow-node--client' },
	{ label: 'not shipped yet', class: 'rs-flow-node--planned' },
]
</script>

<template>
	<div class="rs-container py-10 sm:py-14">
		<header class="max-w-2xl">
			<h1
				class="text-[2rem] leading-10 font-semibold text-highlighted sm:text-5xl sm:leading-[1.05]"
			>
				how resell.sh is built
			</h1>
			<p class="mt-4 text-lg text-toned">
				a small marketplace, drawn box by box: where a request goes, how a payment becomes a
				payout, and what changes when traffic grows. every diagram links to the chapter that
				explains it.
			</p>
			<p class="mt-3 text-sm text-muted">drag to pan, pinch or use the buttons to zoom.</p>
		</header>

		<ul class="mt-8 flex flex-wrap gap-3 border border-default p-3 text-sm" aria-label="legend">
			<li v-for="item in legend" :key="item.label" class="flex items-center gap-2">
				<span class="rs-flow-node h-4 !w-7 !p-0" :class="item.class" aria-hidden="true" />
				<span class="text-toned">{{ item.label }}</span>
			</li>
		</ul>

		<section
			v-for="diagram in systemDesignDiagrams"
			:key="diagram.id"
			:aria-labelledby="`${diagram.id}-heading`"
			class="mt-16"
		>
			<SectionHeader :title="diagram.title" :heading-id="`${diagram.id}-heading`" />
			<p :id="`${diagram.id}-summary`" class="max-w-2xl text-toned">{{ diagram.summary }}</p>

			<div class="mt-6 border border-default">
				<!-- Fixed height on the wrapper: Vue Flow fills 100% of it, and the SSR placeholder matches. -->
				<div class="h-64 sm:h-[28rem]">
					<ClientOnly>
						<SystemDesignDiagram
							:diagram="diagram"
							:described-by="`${diagram.id}-summary`"
						/>
						<template #fallback>
							<div class="rs-flow h-full" />
						</template>
					</ClientOnly>
				</div>
				<a
					:href="`${docsUrl}${diagram.doc}`"
					class="flex items-center justify-between gap-3 border-t border-default px-4 py-3 text-sm font-bold text-primary hover:underline underline-offset-4"
				>
					<span
						>read the chapter:
						<span class="font-mono font-normal normal-case">{{
							diagram.doc
						}}</span></span
					>
					<UIcon
						name="i-lucide-arrow-up-right"
						class="size-4 shrink-0"
						aria-hidden="true"
					/>
				</a>
			</div>
		</section>
	</div>
</template>
