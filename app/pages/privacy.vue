<script setup lang="ts">
useSeoMeta({ title: 'Privacy policy — Marketplace' })

const sections = [
  {
    title: '1. What we collect',
    body: 'Account details (name, email, password hash), addresses for shipping, product listings, order history, and support messages you send us.',
  },
  {
    title: '2. How we use it',
    body: 'To operate your account, process orders and payments, deliver digital files, calculate seller payouts, and respond to support requests.',
  },
  {
    title: '3. Payments',
    body: 'Card details are handled entirely by Stripe; we never see or store full card numbers. We keep a record of each transaction for accounting and dispute handling.',
  },
  {
    title: '4. Sharing',
    body: 'We share the minimum required data with Stripe (payments) and Resend (transactional email). We do not sell your data.',
  },
  {
    title: '5. Retention',
    body: 'Account and order data is kept while your account is active and as long as needed for accounting records (transaction logs are append-only).',
  },
  {
    title: '6. Your rights',
    body: 'You can update your profile and addresses at any time, or contact us to request deletion of your account.',
  },
]
</script>

<template>
  <UContainer class="max-w-2xl py-10">
    <UPageHeader
      title="Privacy policy"
      description="This is a demo project built to learn Nuxt; this policy is illustrative, not legal advice."
    />

    <div class="mt-8 space-y-6">
      <section v-for="section in sections" :key="section.title">
        <h2 class="font-semibold text-highlighted">{{ section.title }}</h2>
        <p class="mt-1 text-sm text-muted">{{ section.body }}</p>
      </section>
    </div>
  </UContainer>
</template>
