<script setup lang="ts">
import type { CartLine } from '#shared/types/cart'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'your cart' })

const { cart, refresh, setQuantity, remove } = useCart()
const toast = useToast()
await useAsyncData('cart-page', () => refresh().then(() => true))

const busy = ref<string | null>(null)
async function mutate(productId: string, action: () => Promise<void>) {
	busy.value = productId
	try {
		await action()
	} catch (error) {
		toast.add({
			title: 'could not update your cart',
			description: apiErrorMessage(error),
			color: 'error',
		})
		await refresh()
	} finally {
		busy.value = null
	}
}

const problems: Record<NonNullable<CartLine['problem']>, string> = {
	unavailable: 'no longer for sale. remove it to check out.',
	out_of_stock: 'sold out in the meantime. remove it to check out.',
	not_enough_stock: 'fewer left than you picked. lower the quantity.',
}
</script>

<template>
	<div class="rs-container py-6">
		<h1 class="text-[2rem] leading-10 font-semibold text-highlighted">your cart</h1>

		<div v-if="!cart?.groups.length" class="mt-8 rounded-xl bg-muted px-6 py-16 text-center">
			<UIcon name="i-lucide-shopping-bag" class="size-10 text-dimmed" />
			<p class="mt-3 text-xl font-semibold text-highlighted">nothing in here yet</p>
			<p class="mt-1 text-muted">go find something you’ll actually use.</p>
			<UButton class="mt-6" to="/marketplace">browse the marketplace</UButton>
		</div>

		<div v-else class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
			<div class="flex flex-col gap-8">
				<section
					v-for="group in cart.groups"
					:key="group.shopId"
					:aria-labelledby="`shop-${group.shopId}`"
				>
					<h2
						:id="`shop-${group.shopId}`"
						class="flex items-baseline gap-2 border-b border-default pb-2"
					>
						<span class="text-sm text-muted">from</span>
						<NuxtLink
							:to="`/shops/${group.shopSlug}`"
							class="font-bold text-highlighted hover:text-primary"
							>{{
								group.shopName
							}}</NuxtLink
						>
					</h2>
					<ul class="divide-y divide-default">
						<li
							v-for="line in group.lines"
							:key="line.productId"
							class="flex gap-4 py-4"
							:class="busy === line.productId && 'opacity-60'"
						>
							<NuxtLink
								:to="`/products/${line.slug}`"
								class="@container size-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-24"
								tabindex="-1"
								aria-hidden="true"
							>
								<ProductPhoto
									:src="line.coverPath"
									:title="line.title"
									:kind="line.kind"
								/>
							</NuxtLink>
							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<div class="flex items-start justify-between gap-3">
									<NuxtLink
										:to="`/products/${line.slug}`"
										class="line-clamp-2 font-semibold text-highlighted hover:text-primary"
										>{{
											line.title
										}}</NuxtLink
									>
									<p class="shrink-0 font-bold text-highlighted tabular-nums">
										{{ formatMoney(line.priceCents * line.quantity) }}
									</p>
								</div>
								<p class="text-sm text-muted">
									<template v-if="line.kind === 'digital'"
										>instant download</template
									>
									<template v-else-if="line.shippingCents">
										+ {{ formatMoney(line.shippingCents) }} shipping
									</template>
									<template v-else>free shipping</template>
								</p>
								<p
									v-if="line.problem"
									class="text-sm font-semibold text-error"
									role="alert"
								>
									{{ problems[line.problem] }}
								</p>
								<div class="mt-auto flex items-center justify-between gap-3 pt-1">
									<UInputNumber
										v-if="line.kind === 'physical'"
										:model-value="line.quantity"
										:min="1"
										:max="line.stock ?? 99"
										size="sm"
										class="w-28"
										:aria-label="`quantity of ${line.title}`"
										:disabled="busy === line.productId || line.problem === 'unavailable'"
										@update:model-value="
											(quantity) =>
												quantity && mutate(line.productId, () => setQuantity(line.productId, quantity))
										"
									/>
									<span v-else class="text-sm text-muted">1 copy</span>
									<UButton
										variant="link"
										color="neutral"
										size="sm"
										icon="i-lucide-trash-2"
										:aria-label="`remove ${line.title}`"
										:disabled="busy === line.productId"
										@click="mutate(line.productId, () => remove(line.productId))"
										>remove</UButton
									>
								</div>
							</div>
						</li>
					</ul>
				</section>
			</div>

			<aside
				class="flex flex-col gap-3 rounded-xl bg-muted p-5 lg:sticky lg:top-36"
				aria-label="order summary"
			>
				<dl class="flex flex-col gap-2 tabular-nums">
					<div class="flex justify-between">
						<dt class="text-toned">items ({{ cart.count }})</dt>
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
						<dt class="font-semibold text-highlighted">total</dt>
						<dd class="font-bold text-highlighted">
							{{ formatMoney(cart.totalCents) }}
						</dd>
					</div>
				</dl>
				<UButton size="xl" block to="/checkout" :disabled="!cart.canCheckout"
					>check out</UButton
				>
				<p class="text-center text-sm text-muted">
					{{
						cart.groups.length > 1
							? `${cart.groups.length} sellers, one payment.`
							: 'you pay on stripe’s secure checkout.'
					}}
				</p>
			</aside>
		</div>
	</div>
</template>
