<script setup lang="ts">
definePageMeta({ layout: 'my-shop', middleware: 'auth' })
useSeoMeta({ title: 'Finishing up — Marketplace' })

const toast = useToast()

onMounted(async () => {
	toast.add({ title: 'Almost there', description: 'Confirming your Stripe account status…' })
	// Reads the account from Stripe now instead of waiting for the account.updated webhook.
	await $fetch('/api/v1/shop/stripe/sync', { method: 'POST' }).catch(() => undefined)
	await navigateTo('/my-shop/payouts')
})
</script>

<template>
	<UContainer class="max-w-2xl py-10">
		<h1 class="sr-only">Finishing Stripe onboarding</h1>
		<p class="text-sm text-muted">Redirecting…</p>
	</UContainer>
</template>
