<script setup lang="ts">
import type { Shop } from '#shared/types/db'

definePageMeta({ layout: 'my-shop', middleware: 'auth' })
useSeoMeta({ title: 'Payouts — Marketplace' })

const toast = useToast()
const { data: shop } = await useFetch<Shop | null>('/api/v1/shop')
if (!shop.value) {
	await navigateTo('/my-shop')
}

const pending = ref(false)
async function connectStripe() {
	pending.value = true
	try {
		const { url } = await $fetch<{ url: string }>('/api/v1/shop/stripe/onboarding', {
			method: 'POST',
		})
		await navigateTo(url, { external: true })
	} catch (error) {
		const statusMessage =
			(error as { data?: { statusMessage?: string } })?.data?.statusMessage ??
			'Something went wrong'
		toast.add({
			title: 'Could not start onboarding',
			description: statusMessage,
			color: 'error',
		})
	} finally {
		pending.value = false
	}
}
</script>

<template>
	<UContainer class="max-w-2xl py-10 space-y-6">
		<h1 class="text-2xl font-semibold">Payouts</h1>

		<UPageCard
			title="Stripe Connect"
			description="Sellers get paid out through a Stripe Express account."
		>
			<div v-if="shop?.chargesEnabled" class="flex items-center gap-2">
				<UIcon
					name="i-lucide-check-circle-2"
					class="size-5 text-success"
					aria-hidden="true"
				/>
				<p class="text-sm">Your Stripe account is connected. You can publish products.</p>
			</div>
			<div v-else class="space-y-4">
				<p class="text-sm text-muted">
					Connect a Stripe Express account to receive payouts. This is required before you
					can publish products.
				</p>
				<UButton icon="i-simple-icons-stripe" :loading="pending" @click="connectStripe">
					Connect with Stripe
				</UButton>
			</div>
		</UPageCard>
	</UContainer>
</template>
