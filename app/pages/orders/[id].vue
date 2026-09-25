<script setup lang="ts">
import type { BuyerOrder, BuyerSellerOrder } from '#shared/types/order'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const { data: order, refresh } = await useFetch<BuyerOrder>(
	() => `/api/orders/${String(route.params.id)}`,
)
if (!order.value) {
	throw createError({ statusCode: 404, statusMessage: 'Order not found', fatal: true })
}
const view = computed(() => order.value as BuyerOrder)
useSeoMeta({ title: () => `order #${view.value.id.slice(-8)}` })

function sellerStatus(seller: BuyerSellerOrder) {
	const digitalOnly = seller.items.every((item) => item.kind === 'digital')
	if (seller.status === 'paid' && digitalOnly) {
		return { label: 'ready to download', color: 'success' as const }
	}
	if (seller.status === 'paid')
		return { label: 'seller is preparing it', color: 'primary' as const }
	return sellerOrderStatusLabel[seller.status]
}

const address = computed(() => {
	const a = view.value.shippingAddress
	if (!a) return null
	return [a.fullName, a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`, a.country]
		.filter(Boolean)
		.join('\n')
})

// Links are signed for ~10 minutes (D8); refetch before they go stale on a long-open tab.
const timer = import.meta.client ? setInterval(() => refresh(), 5 * 60_000) : undefined
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
	<div class="rs-container max-w-3xl py-6">
		<UBreadcrumb
			:items="[{ label: 'your orders', to: '/orders' }, { label: `#${view.id.slice(-8)}` }]"
			:ui="{ link: 'text-base font-medium' }"
		/>

		<div class="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
			<h1 class="text-[2rem] leading-10 font-semibold text-highlighted">
				{{ formatDate(view.createdAt) }}
			</h1>
			<UBadge
				:color="orderStatusLabel[view.status].color"
				variant="subtle"
				size="lg"
				:label="orderStatusLabel[view.status].label"
			/>
		</div>
		<p class="mt-1 font-mono text-sm text-muted">order {{ view.id }}</p>

		<section
			v-for="seller in view.sellers"
			:key="seller.id"
			:aria-labelledby="`seller-${seller.id}`"
			class="mt-8"
		>
			<div
				class="flex flex-wrap items-center justify-between gap-2 border-b border-default pb-2"
			>
				<h2 :id="`seller-${seller.id}`" class="flex items-baseline gap-2">
					<span class="text-sm text-muted">from</span>
					<NuxtLink
						:to="`/shops/${seller.shopSlug}`"
						class="font-bold text-highlighted hover:text-primary"
						>{{
							seller.shopName
						}}</NuxtLink
					>
				</h2>
				<UBadge
					:color="sellerStatus(seller).color"
					variant="subtle"
					:label="sellerStatus(seller).label"
				/>
			</div>

			<p
				v-if="seller.trackingCode"
				class="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-toned"
			>
				<UIcon name="i-lucide-truck" class="size-4 text-primary" />
				shipped with <strong class="text-highlighted">{{ seller.carrier }}</strong>
				<span v-if="seller.shippedAt">on {{ formatDate(seller.shippedAt) }}</span>
				· tracking
				<span class="font-mono font-semibold text-highlighted select-all">{{
					seller.trackingCode
				}}</span>
			</p>

			<ul class="divide-y divide-default">
				<li v-for="item in seller.items" :key="item.id" class="flex flex-col gap-3 py-4">
					<div class="flex items-start justify-between gap-3">
						<NuxtLink
							:to="`/products/${item.productSlug}`"
							class="font-semibold text-highlighted hover:text-primary"
							>{{ item.quantity }}
							× {{ item.title }}</NuxtLink
						>
						<p class="shrink-0 font-bold text-highlighted tabular-nums">
							{{ formatMoney(item.priceCents * item.quantity) }}
						</p>
					</div>

					<ul v-if="item.downloads.length" class="flex flex-col gap-2">
						<li
							v-for="download in item.downloads"
							:key="download.id"
							class="flex flex-wrap items-center gap-x-3 gap-y-1"
						>
							<UButton
								v-if="download.url"
								:href="download.url"
								external
								icon="i-lucide-download"
								size="sm"
								:label="download.filename"
							/>
							<span
								v-else
								class="flex items-center gap-1.5 text-sm font-semibold text-muted"
							>
								<UIcon name="i-lucide-download" class="size-4" />
								{{ download.filename }}
							</span>
							<span class="text-sm text-muted">
								<template v-if="download.url">
									{{ download.downloadsLeft }}
									{{ download.downloadsLeft === 1 ? 'download' : 'downloads' }}
									left · until
									{{ formatDate(download.expiresAt) }}
								</template>
								<template v-else-if="seller.status === 'refunded'"
									>refunded, no longer available</template
								>
								<template v-else>no longer available</template>
							</span>
						</li>
					</ul>

					<p v-if="item.review" class="flex items-center gap-1.5 text-sm text-toned">
						<UIcon name="i-lucide-star" class="size-4 text-primary" />
						you rated it
						<strong class="text-highlighted">{{ item.review.rating }}/5</strong>
						<span v-if="item.review.comment" class="truncate"
							>· “{{ item.review.comment }}”</span
						>
					</p>
					<OrderReviewForm
						v-else-if="item.canReview"
						:order-item-id="item.id"
						:title="item.title"
						@reviewed="refresh()"
					/>
				</li>
			</ul>
		</section>

		<div class="mt-8 grid gap-6 border-t border-default pt-6 sm:grid-cols-2">
			<div v-if="address">
				<h2 class="text-sm font-semibold text-highlighted">ships to</h2>
				<p class="mt-1 text-sm whitespace-pre-line text-toned">{{ address }}</p>
			</div>
			<dl class="flex flex-col gap-1 tabular-nums sm:col-start-2">
				<div class="flex justify-between">
					<dt class="text-toned">items</dt>
					<dd class="font-semibold text-highlighted">
						{{ formatMoney(view.subtotalCents) }}
					</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-toned">shipping</dt>
					<dd class="font-semibold text-highlighted">
						{{ formatMoney(view.shippingCents) }}
					</dd>
				</div>
				<div class="mt-1 flex justify-between border-t border-default pt-2 text-lg">
					<dt class="font-semibold text-highlighted">total paid</dt>
					<dd class="font-bold text-highlighted">{{ formatMoney(view.totalCents) }}</dd>
				</div>
			</dl>
		</div>
	</div>
</template>
