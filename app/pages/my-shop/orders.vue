<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { type ShipSellerOrderInput, shipSellerOrderSchema } from '#shared/schemas/order'
import type { ShopOrder } from '#shared/types/order'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'orders — my shop' })

const toast = useToast()
const { data: orders, refresh, status } = await useFetch<ShopOrder[]>('/api/v1/shop/orders')

const toShip = computed(() => orders.value?.filter((order) => needsShipping(order)).length ?? 0)

function isPhysical(order: ShopOrder) {
	return order.items.some((item) => item.kind === 'physical')
}
function needsShipping(order: ShopOrder) {
	return order.status === 'paid' && isPhysical(order)
}
function statusOf(order: ShopOrder) {
	if (order.status === 'paid' && !isPhysical(order)) {
		return { label: 'delivered by download', color: 'neutral' as const }
	}
	return sellerOrderStatusLabel[order.status]
}
function addressOf(order: ShopOrder) {
	const a = order.shippingAddress
	if (!a) return ''
	return [
		a.fullName,
		a.line1,
		a.line2,
		`${a.city}, ${a.state} ${a.postalCode}`,
		a.country,
		a.phone,
	]
		.filter(Boolean)
		.join('\n')
}

const busy = ref<string | null>(null)
async function act(order: ShopOrder, action: 'ship' | 'deliver' | 'refund', body?: object) {
	busy.value = order.id
	try {
		await $fetch(`/api/v1/shop/orders/${order.id}/${action}`, { method: 'POST', body })
		await refresh()
		return true
	} catch (error) {
		toast.add({
			title: 'that didn’t work',
			description: apiErrorMessage(error),
			color: 'error',
		})
		return false
	} finally {
		busy.value = null
	}
}
// Separate open flags: the selected order stays set so the dialog doesn't blank out while closing.
const shipping = ref<ShopOrder | null>(null)
const shipOpen = ref(false)
const shipState = reactive<ShipSellerOrderInput>({ carrier: '', trackingCode: '' })
function openShip(order: ShopOrder) {
	shipState.carrier = order.carrier ?? ''
	shipState.trackingCode = order.trackingCode ?? ''
	shipping.value = order
	shipOpen.value = true
}
async function ship(event: FormSubmitEvent<ShipSellerOrderInput>) {
	if (!shipping.value) return
	if (await act(shipping.value, 'ship', event.data)) {
		toast.add({
			title: 'marked as shipped. the buyer got the tracking code.',
			color: 'success',
		})
		shipOpen.value = false
	}
}

const refunding = ref<ShopOrder | null>(null)
const refundOpen = ref(false)
function openRefund(order: ShopOrder) {
	refunding.value = order
	refundOpen.value = true
}
async function refund() {
	if (!refunding.value) return
	if (await act(refunding.value, 'refund')) {
		toast.add({ title: 'refund sent', color: 'success' })
		refundOpen.value = false
	}
}
</script>

<template>
	<UContainer class="max-w-3xl space-y-6 py-10">
		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<h1 class="text-2xl font-semibold text-highlighted">orders</h1>
			<p v-if="toShip" class="text-sm font-semibold text-primary">{{ toShip }} to ship</p>
		</div>

		<div v-if="status === 'pending'" class="space-y-3">
			<USkeleton v-for="n in 3" :key="n" class="h-28 w-full" />
		</div>

		<div v-else-if="!orders?.length" class="rounded-xl bg-muted px-6 py-14 text-center">
			<UIcon name="i-lucide-receipt" class="size-10 text-dimmed" />
			<p class="mt-3 text-lg font-semibold text-highlighted">no sales yet</p>
			<p class="mt-1 text-muted">when someone buys from your shop, it lands here.</p>
			<UButton class="mt-6" variant="outline" to="/my-shop/products"
				>see your products</UButton
			>
		</div>

		<ul v-else class="space-y-3">
			<li
				v-for="order in orders"
				:key="order.id"
				class="rounded-lg p-4 ring-1 ring-default"
				:class="needsShipping(order) && 'ring-primary/60'"
				:aria-busy="busy === order.id"
			>
				<div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
					<div class="min-w-0">
						<p class="font-semibold text-highlighted">
							{{ order.buyerName }}
							<span class="font-mono text-sm font-medium text-muted"
								>#{{ order.orderId.slice(-8) }}</span
							>
						</p>
						<p class="text-sm text-muted">{{ formatDate(order.createdAt) }}</p>
					</div>
					<div class="flex items-center gap-3">
						<UBadge
							:color="statusOf(order).color"
							variant="subtle"
							:label="statusOf(order).label"
						/>
						<p class="text-right tabular-nums">
							<span class="block font-bold text-highlighted">{{
								formatMoney(order.payoutCents)
							}}</span>
							<span class="block text-xs text-muted">your payout</span>
						</p>
					</div>
				</div>

				<ul class="mt-3 text-sm text-toned">
					<li v-for="(item, index) in order.items" :key="index">
						{{ item.quantity }} × {{ item.title }}
						<span v-if="item.kind === 'digital'" class="text-muted">· digital</span>
					</li>
				</ul>

				<details v-if="order.shippingAddress" class="mt-2 text-sm">
					<summary class="cursor-pointer font-semibold text-highlighted">ship to</summary>
					<p class="mt-1 whitespace-pre-line text-toned">{{ addressOf(order) }}</p>
				</details>

				<p v-if="order.trackingCode" class="mt-2 text-sm text-toned">
					{{ order.carrier }} ·
					<span class="font-mono text-highlighted select-all">{{
						order.trackingCode
					}}</span>
				</p>

				<div
					v-if="order.status !== 'refunded'"
					class="mt-4 flex flex-wrap items-center gap-2"
				>
					<UButton
						v-if="needsShipping(order)"
						icon="i-lucide-truck"
						size="sm"
						:disabled="busy === order.id"
						@click="openShip(order)"
						>mark shipped</UButton
					>
					<template v-if="order.status === 'shipped'">
						<UButton
							icon="i-lucide-package-check"
							size="sm"
							:loading="busy === order.id"
							@click="act(order, 'deliver')"
							>mark delivered</UButton
						>
						<UButton
							size="sm"
							color="neutral"
							variant="ghost"
							:disabled="busy === order.id"
							@click="openShip(order)"
							>edit tracking</UButton
						>
					</template>
					<UButton
						class="ms-auto"
						size="sm"
						color="error"
						variant="ghost"
						:disabled="busy === order.id"
						@click="openRefund(order)"
						>refund</UButton
					>
				</div>
			</li>
		</ul>

		<UModal
			v-model:open="shipOpen"
			title="mark as shipped"
			description="the buyer gets an email with the tracking code."
		>
			<template #body>
				<UForm
					:schema="shipSellerOrderSchema"
					:state="shipState"
					class="space-y-4"
					@submit="ship"
				>
					<UFormField label="carrier" name="carrier" required>
						<UInput v-model="shipState.carrier" placeholder="usps" class="w-full" />
					</UFormField>
					<UFormField label="tracking code" name="trackingCode" required>
						<UInput
							v-model="shipState.trackingCode"
							class="w-full font-mono"
							autocomplete="off"
							spellcheck="false"
						/>
					</UFormField>
					<div class="flex justify-end gap-2">
						<UButton color="neutral" variant="subtle" @click="shipOpen = false"
							>cancel</UButton
						>
						<UButton type="submit" :loading="busy === shipping?.id">save</UButton>
					</div>
				</UForm>
			</template>
		</UModal>

		<UModal v-model:open="refundOpen" title="refund this order?">
			<template #body>
				<p class="text-sm text-toned">
					<strong class="text-highlighted">{{ refunding?.buyerName }}</strong>
					gets back
					<strong class="text-highlighted tabular-nums">{{
						formatMoney((refunding?.subtotalCents ?? 0) + (refunding?.shippingCents ?? 0))
					}}</strong>
					and your
					<strong class="text-highlighted tabular-nums">{{
						formatMoney(refunding?.payoutCents ?? 0)
					}}</strong>
					payout is taken back. digital downloads stop working. this can’t be undone.
				</p>
				<div class="mt-4 flex justify-end gap-2">
					<UButton color="neutral" variant="subtle" @click="refundOpen = false"
						>keep order</UButton
					>
					<UButton color="error" :loading="busy === refunding?.id" @click="refund"
						>refund in full</UButton
					>
				</div>
			</template>
		</UModal>
	</UContainer>
</template>
