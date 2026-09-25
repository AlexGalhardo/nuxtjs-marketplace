<script setup lang="ts">
import type { Address } from '#shared/types/db'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'checkout' })

const { cart, refresh } = useCart()
const toast = useToast()
await useAsyncData('checkout-cart', () => refresh().then(() => true))
if (!cart.value?.groups.length) {
	await navigateTo('/cart', { replace: true })
}

const { data: addresses } = await useFetch<Address[]>('/api/profile/addresses', {
	default: () => [],
})
const addressId = ref(
	(addresses.value.find((address) => address.isDefault) ?? addresses.value[0])?.id,
)
const addressItems = computed(() =>
	addresses.value.map((address) => ({
		value: address.id,
		label: address.fullName,
		description: [
			address.line1,
			address.line2,
			`${address.city}, ${address.state} ${address.postalCode}`,
			address.country,
		]
			.filter(Boolean)
			.join(' · '),
	})),
)

const needsAddress = computed(() => Boolean(cart.value?.hasPhysical))
const paying = ref(false)
async function pay() {
	paying.value = true
	try {
		const { url } = await $fetch<{ url: string }>('/api/checkout', {
			method: 'POST',
			body: { addressId: needsAddress.value ? addressId.value : undefined },
		})
		await navigateTo(url, { external: true })
	} catch (error) {
		paying.value = false
		toast.add({
			title: 'checkout did not start',
			description: apiErrorMessage(error),
			color: 'error',
		})
		await refresh()
	}
}
</script>

<template>
	<div v-if="cart?.groups.length" class="rs-container py-6">
		<UBreadcrumb
			:items="[{ label: 'cart', to: '/cart' }, { label: 'checkout' }]"
			class="mb-4"
			:ui="{ link: 'text-base font-medium' }"
		/>
		<h1 class="text-[2rem] leading-10 font-semibold text-highlighted">checkout</h1>

		<div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
			<div class="flex flex-col gap-8">
				<section v-if="needsAddress" aria-labelledby="ship-to">
					<h2 id="ship-to" class="text-xl font-semibold text-highlighted">ship to</h2>
					<URadioGroup
						v-if="addressItems.length"
						v-model="addressId"
						:items="addressItems"
						variant="card"
						class="mt-3"
						legend="shipping address"
						:ui="{ legend: 'sr-only', fieldset: 'gap-2', item: 'rounded-xl', description: 'normal-case' }"
					/>
					<div v-else class="mt-3 rounded-xl bg-muted p-5">
						<p class="font-semibold text-highlighted">no address on file yet</p>
						<p class="mt-1 text-muted">sellers need somewhere to ship your stuff.</p>
						<UButton class="mt-4" variant="outline" to="/profile" icon="i-lucide-plus">
							add an address
						</UButton>
					</div>
				</section>
				<p v-else class="rounded-xl bg-muted p-5 text-toned">
					everything here is digital: no address needed. downloads unlock right after you
					pay.
				</p>

				<section aria-labelledby="review">
					<h2 id="review" class="text-xl font-semibold text-highlighted">review</h2>
					<ul class="mt-3 divide-y divide-default">
						<template v-for="group in cart.groups" :key="group.shopId">
							<li
								v-for="line in group.lines"
								:key="line.productId"
								class="flex justify-between gap-4 py-3"
							>
								<span class="min-w-0">
									<span class="block truncate font-medium text-highlighted">
										{{ line.quantity }}
										× {{ line.title }}
									</span>
									<span class="text-sm text-muted"
										>from {{ group.shopName }}</span
									>
								</span>
								<span class="font-semibold text-highlighted tabular-nums">
									{{ formatMoney(line.priceCents * line.quantity) }}
								</span>
							</li>
						</template>
					</ul>
				</section>
			</div>

			<aside
				class="flex flex-col gap-3 rounded-xl bg-muted p-5 lg:sticky lg:top-36"
				aria-label="order summary"
			>
				<dl class="flex flex-col gap-2 tabular-nums">
					<div class="flex justify-between">
						<dt class="text-toned">items</dt>
						<dd class="font-semibold text-highlighted">
							{{ formatMoney(cart.subtotalCents) }}
						</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-toned">shipping</dt>
						<dd class="font-semibold text-highlighted">
							{{ cart.shippingCents ? formatMoney(cart.shippingCents) : 'free' }}
						</dd>
					</div>
					<div class="mt-1 flex justify-between border-t border-accented pt-3 text-lg">
						<dt class="font-semibold text-highlighted">you pay</dt>
						<dd class="font-bold text-highlighted">
							{{ formatMoney(cart.totalCents) }}
						</dd>
					</div>
				</dl>
				<UButton
					size="xl"
					block
					icon="i-lucide-lock"
					:loading="paying"
					:disabled="!cart.canCheckout || (needsAddress && !addressId)"
					@click="pay"
				>
					pay with stripe
				</UButton>
				<p class="text-center text-sm text-muted">
					you’ll finish paying on stripe, then come right back.
				</p>
			</aside>
		</div>
	</div>
</template>
