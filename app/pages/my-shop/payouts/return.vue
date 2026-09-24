<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Finishing up — Marketplace' })

const toast = useToast()

onMounted(async () => {
	toast.add({ title: 'Almost there', description: 'Confirming your Stripe account status…' })
	await navigateTo('/my-shop/payouts')
})
</script>

<template>
	<UContainer class="max-w-2xl py-10">
		<h1 class="sr-only">Finishing Stripe onboarding</h1>
		<p class="text-sm text-muted">Redirecting…</p>
	</UContainer>
</template>
