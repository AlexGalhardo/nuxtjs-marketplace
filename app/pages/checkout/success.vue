<script setup lang="ts">
import type { BuyerOrder } from '#shared/types/order'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'thanks!' })

const route = useRoute()
const orderId = computed(() => (typeof route.query.order === 'string' ? route.query.order : ''))
const { data: order, refresh } = await useFetch<BuyerOrder>(() => `/api/orders/${orderId.value}`)

// Stripe redirects here before (or right after) its webhook lands: poll briefly while pending.
const { refresh: refreshCart } = useCart()
let attempts = 0
const timer = import.meta.client ? setInterval(poll, 2000) : undefined
async function poll() {
	attempts += 1
	if (order.value?.status !== 'pending' || attempts > 15) {
		clearInterval(timer)
		await refreshCart()
		return
	}
	await refresh()
}
onBeforeUnmount(() => clearInterval(timer))

const items = computed(
	() =>
		order.value?.sellers.flatMap((seller) =>
			seller.items.map((item) => ({ ...item, shopName: seller.shopName })),
		) ?? [],
)
const hasDigital = computed(() => items.value.some((item) => item.kind === 'digital'))
const hasPhysical = computed(() => items.value.some((item) => item.kind === 'physical'))
</script>

<template>
	<div class="rs-container max-w-2xl py-12">
		<div v-if="!order" class="rounded-xl bg-muted px-6 py-16 text-center">
			<p class="text-xl font-semibold text-highlighted">we couldn’t find that order</p>
			<UButton class="mt-6" variant="outline" to="/marketplace"
				>back to the marketplace</UButton
			>
		</div>

		<template v-else>
			<p class="font-mono text-sm font-bold text-primary" aria-hidden="true">
				$ order {{ order.id.slice(-8) }} --status {{ order.status }}
			</p>
			<h1
				class="mt-2 text-[2rem] leading-10 font-semibold text-balance text-highlighted"
				aria-live="polite"
			>
				<template v-if="order.status === 'paid'">paid. nice find.</template>
				<template v-else-if="order.status === 'pending'">confirming your payment…</template>
				<template v-else>this order didn’t go through</template>
			</h1>
			<p class="mt-2 text-toned">
				<template v-if="order.status === 'paid'">
					you paid
					<strong class="tabular-nums">{{ formatMoney(order.totalCents) }}</strong>. a
					receipt is on its way to your inbox.
					<template v-if="hasPhysical">
						sellers get notified to ship your stuff.</template
					>
					<template v-if="hasDigital"> your downloads are unlocked.</template>
				</template>
				<template v-else-if="order.status === 'pending'">
					this usually takes a few seconds. you can leave this page: we’ll email you once
					it’s confirmed.
				</template>
				<template v-else
					>nothing was charged. your cart is still there if you want to try
					again.</template
				>
			</p>

			<ul class="mt-8 divide-y divide-default border-y border-default">
				<li
					v-for="item in items"
					:key="item.id"
					class="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3"
				>
					<span class="font-medium text-highlighted"
						>{{ item.quantity }}
						× {{ item.title }}</span
					>
					<span class="min-w-0 text-sm wrap-break-word text-muted">{{
						item.shopName
					}}</span>
				</li>
			</ul>

			<div class="mt-8 flex flex-wrap gap-3">
				<UButton v-if="order.status !== 'paid' && order.status !== 'pending'" to="/cart"
					>back to cart</UButton
				>
				<UButton v-if="order.status === 'paid'" :to="`/orders/${order.id}`">
					{{ hasDigital ? 'get your downloads' : 'track your order' }}
				</UButton>
				<UButton variant="outline" to="/marketplace">keep browsing</UButton>
			</div>
		</template>
	</div>
</template>
