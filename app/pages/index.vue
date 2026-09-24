<script setup lang="ts">
import type { CatalogItem } from '#shared/types/catalog'
import type { ProductType } from '#shared/types/db'

useSeoMeta({
	title: 'resell.sh — buy and sell secondhand and digital stuff',
	description:
		'a marketplace for things you own and things you make. list for free, pay 10% only when it sells.',
})

type Page = { data: CatalogItem[] }
const [{ data: fresh }, { data: digital }, { data: cheap }, { data: productTypes }] =
	await Promise.all([
		useFetch<Page>('/api/products', { key: 'home-fresh', query: { perPage: 6 } }),
		useFetch<Page>('/api/products', {
			key: 'home-digital',
			query: { perPage: 6, kind: 'digital' },
		}),
		useFetch<Page>('/api/products', {
			key: 'home-cheap',
			query: { perPage: 6, maxPrice: 20, sort: 'price-asc' },
		}),
		useFetch<ProductType[]>('/api/product-types', { key: 'product-types', default: () => [] }),
	])

const rows = computed(() => [
	{
		title: 'fresh drops',
		subtitle: 'just listed, still warm',
		to: '/marketplace',
		linkLabel: 'see all',
		items: fresh.value?.data ?? [],
	},
	{
		title: 'instant downloads',
		subtitle: 'no shipping, no waiting, no box to recycle',
		to: '/marketplace?kind=digital',
		linkLabel: 'grab one',
		items: digital.value?.data ?? [],
	},
	{
		title: 'under $20',
		subtitle: 'cheap thrills, sorted by price',
		to: '/marketplace?maxPrice=20&sort=price-asc',
		linkLabel: 'dig in',
		items: cheap.value?.data ?? [],
	},
])

const steps = [
	{
		title: 'open your shop',
		text: 'pick a name and a url. logo and banner whenever you feel like it.',
	},
	{
		title: 'connect stripe',
		text: 'a quick stripe express signup so payouts land in your account.',
	},
	{
		title: 'list and ship',
		text: 'add photos, set a price, publish. ship it, or we deliver the file.',
	},
]
</script>

<template>
	<div class="rs-container space-y-16 py-8 sm:space-y-20">
		<section class="grid gap-6 md:grid-cols-[2fr_1fr] md:items-center">
			<div
				class="relative overflow-hidden rounded-xl bg-(--rs-signal) px-6 py-10 text-(--rs-signal-ink) sm:px-10 sm:py-14"
			>
				<h1 class="font-display text-[clamp(3rem,9vw,6rem)] leading-[0.85] font-black">
					list it free.<br>pay 10% when it sells.
				</h1>
				<p class="mt-6 font-mono text-sm font-bold sm:text-base">
					<span aria-hidden="true">$ </span>resell --everything-you-dont-use
				</p>
			</div>

			<div class="md:ps-4">
				<h2 class="text-[1.75rem] leading-tight font-semibold text-highlighted">
					got stuff lying around?
				</h2>
				<p class="mt-2 font-medium text-muted">
					clothes, gear, presets, templates. if someone else could use it, it sells here.
				</p>
				<UButton to="/my-shop" size="xl" variant="outline" class="mt-6"
					>open your shop</UButton
				>
			</div>
		</section>

		<section
			v-for="row in rows"
			:key="row.title"
			:aria-labelledby="`row-${slugify(row.title)}`"
		>
			<SectionHeader
				:heading-id="`row-${slugify(row.title)}`"
				:title="row.title"
				:subtitle="row.subtitle"
				:to="row.to"
				:link-label="row.linkLabel"
			/>
			<ProductMosaic v-if="row.items.length" :items="row.items" />
			<p v-else class="rounded-lg bg-muted px-6 py-10 text-center font-medium text-muted">
				nothing here yet. be the first:
				<NuxtLink to="/my-shop" class="font-bold text-primary underline underline-offset-4"
					>list something</NuxtLink
				>.
			</p>
		</section>

		<section aria-labelledby="row-types">
			<SectionHeader
				heading-id="row-types"
				title="browse by type"
				subtitle="twelve aisles, zero elevator music"
				to="/marketplace"
				link-label="everything"
			/>
			<ul class="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
				<li v-for="type in productTypes" :key="type.id">
					<NuxtLink
						:to="`/marketplace?type=${type.slug}`"
						class="group block text-center"
					>
						<span
							class="flex aspect-square items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-(--rs-selected)"
							:class="type.kind === 'digital' && 'bg-ink-950 text-matrix-400 group-hover:bg-ink-900'"
						>
							<UIcon :name="productTypeIcon(type.slug)" class="size-1/3" />
						</span>
						<span class="mt-2 block text-sm font-bold text-highlighted">{{
							type.name
						}}</span>
					</NuxtLink>
				</li>
			</ul>
		</section>

		<section aria-labelledby="how-selling-works" class="rounded-xl bg-muted p-6 sm:p-10">
			<h2
				id="how-selling-works"
				class="text-2xl font-semibold text-highlighted sm:text-[2rem]"
			>
				how selling works
			</h2>
			<ol class="mt-8 grid gap-8 md:grid-cols-3">
				<li v-for="(step, index) in steps" :key="step.title" class="flex gap-4">
					<span
						class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-mono font-bold text-inverted"
						aria-hidden="true"
						>{{
							index + 1
						}}</span
					>
					<div>
						<h3 class="font-bold text-highlighted">{{ step.title }}</h3>
						<p class="mt-1 text-muted">{{ step.text }}</p>
					</div>
				</li>
			</ol>
			<UButton to="/my-shop" size="xl" class="mt-10">start selling</UButton>
		</section>
	</div>
</template>
