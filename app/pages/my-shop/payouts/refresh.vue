<script setup lang="ts">
// Stripe redirects here when an Account Link expired before onboarding finished. Bounce back to
// the payouts page, which lets the seller request a fresh link.
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Reconnecting — Marketplace' })

const toast = useToast()

onMounted(async () => {
	toast.add({
		title: 'That link expired',
		description: 'Start onboarding again below.',
		color: 'warning',
	})
	await navigateTo('/my-shop/payouts')
})
</script>

<template>
	<UContainer class="max-w-2xl py-10">
		<h1 class="sr-only">Reconnecting to Stripe</h1>
		<p class="text-sm text-muted">Redirecting…</p>
	</UContainer>
</template>
