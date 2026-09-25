<script setup lang="ts">
import type { BuyerOrderSummary } from '#shared/types/order'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'your orders' })

const { data: orders } = await useFetch<BuyerOrderSummary[]>('/api/orders')
</script>

<template>
	<div class="rs-container max-w-3xl py-6">
		<h1 class="text-[2rem] leading-10 font-semibold text-highlighted">your orders</h1>

		<div v-if="!orders?.length" class="mt-8 rounded-xl bg-muted px-6 py-16 text-center">
			<UIcon name="i-lucide-receipt" class="size-10 text-dimmed" />
			<p class="mt-3 text-xl font-semibold text-highlighted">no orders yet</p>
			<p class="mt-1 text-muted">what you buy shows up here, with tracking and downloads.</p>
			<UButton class="mt-6" to="/marketplace">browse the marketplace</UButton>
		</div>

		<ul v-else class="mt-6 divide-y divide-default border-y border-default">
			<li v-for="order in orders" :key="order.id">
				<NuxtLink
					:to="`/orders/${order.id}`"
					class="group flex items-center gap-4 py-4 focus-visible:outline-2 focus-visible:outline-primary"
				>
					<div class="min-w-0 flex-1">
						<p class="font-semibold text-highlighted group-hover:text-primary">
							{{ formatDate(order.createdAt) }}
							<span class="font-mono text-sm font-medium text-muted"
								>#{{ order.id.slice(-8) }}</span
							>
						</p>
						<p class="mt-1 flex items-center gap-2 text-sm text-muted">
							{{ order.itemCount }} {{ order.itemCount === 1 ? 'item' : 'items' }}
							<UBadge
								:color="orderStatusLabel[order.status].color"
								variant="subtle"
								size="sm"
								:label="orderStatusLabel[order.status].label"
							/>
						</p>
					</div>
					<p class="shrink-0 font-bold text-highlighted tabular-nums">
						{{ formatMoney(order.totalCents) }}
					</p>
					<UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-muted" />
				</NuxtLink>
			</li>
		</ul>
	</div>
</template>
