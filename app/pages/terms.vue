<script setup lang="ts">
useSeoMeta({ title: 'Terms of service — Marketplace' })

const sections = [
  {
    title: '1. Accounts',
    body: 'You must provide accurate information when creating an account and are responsible for keeping your credentials secure.',
  },
  {
    title: '2. Buying and selling',
    body: 'Sellers are responsible for the accuracy of their product listings, for shipping physical orders, and for delivering digital files as described. Buyers agree to pay the listed price plus any shipping fee shown at checkout.',
  },
  {
    title: '3. Payments',
    body: 'Payments are processed by Stripe. The platform charges a percentage fee on each sale, shown before checkout. Payouts to sellers follow Stripe Connect’s standard timelines.',
  },
  {
    title: '4. Refunds',
    body: 'Sellers may issue full refunds for their own orders. Refunds are logged and reversed through Stripe.',
  },
  {
    title: '5. Prohibited use',
    body: 'You may not list illegal items, infringe on intellectual property, or attempt to abuse or disrupt the platform.',
  },
  {
    title: '6. Changes',
    body: 'These terms may change as the platform evolves. Continued use means you accept updates.',
  },
]
</script>

<template>
  <UContainer class="max-w-2xl py-10">
    <UPageHeader
      title="Terms of service"
      description="This is a demo project built to learn Nuxt; these terms are illustrative, not legal advice."
    />

    <div class="mt-8 space-y-6">
      <section v-for="section in sections" :key="section.title">
        <h2 class="font-semibold text-highlighted">{{ section.title }}</h2>
        <p class="mt-1 text-sm text-muted">{{ section.body }}</p>
      </section>
    </div>
  </UContainer>
</template>
