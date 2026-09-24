<script setup lang="ts">
import type { ProductType } from '#shared/types/db'

useSeoMeta({
  title: 'Marketplace — buy and sell physical and digital products',
})

const { loggedIn } = useAuth()
const { data: productTypes, status: productTypesStatus } =
  await useFetch<ProductType[]>('/api/product-types')

const sellCta = computed(() => (loggedIn.value ? '/my-shop' : '/signup'))

const howItWorks = [
  {
    icon: 'i-lucide-store',
    title: 'Open your shop',
    description: 'Create a shop, add your branding, and connect Stripe to get paid.',
  },
  {
    icon: 'i-lucide-package-plus',
    title: 'List your products',
    description: 'Physical or digital — set a price, stock or files, and publish when ready.',
  },
  {
    icon: 'i-lucide-banknote',
    title: 'Get paid',
    description: 'Buyers pay once at checkout; funds transfer straight to your Stripe account.',
  },
]
</script>

<template>
  <div>
    <UPageHero
      title="Buy and sell anything, physical or digital"
      description="A marketplace for individual sellers: list products, accept payments with Stripe, and ship or deliver — all from one shop."
      :links="[
        { label: 'Browse the marketplace', to: '/marketplace', trailingIcon: 'i-lucide-arrow-right', size: 'xl' },
        { label: 'Start selling', to: sellCta, size: 'xl', color: 'neutral', variant: 'subtle', icon: 'i-lucide-store' },
      ]"
    />

    <UPageSection
      id="categories"
      title="Shop by category"
      description="Every product on the marketplace belongs to a category."
    >
      <div v-if="productTypesStatus === 'pending'" class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <USkeleton v-for="n in 4" :key="n" class="h-24 w-full" />
      </div>
      <div v-else-if="productTypes?.length" class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <UPageCard
          v-for="type in productTypes"
          :key="type.id"
          :title="type.name"
          :to="`/marketplace?type=${type.slug}`"
          :icon="type.kind === 'digital' ? 'i-lucide-download' : 'i-lucide-box'"
          spotlight
        />
      </div>
      <UAlert
        v-else
        icon="i-lucide-info"
        title="No categories yet"
        description="Categories will appear here once they are seeded."
      />
    </UPageSection>

    <UPageSection
      id="featured-products"
      title="Featured products"
      description="Products from sellers will show up here once the catalog launches."
    >
      <UAlert
        icon="i-lucide-sparkles"
        title="No products yet"
        description="Be the first to list a product on the marketplace."
        :actions="[{ label: 'Start selling', to: sellCta, color: 'primary' }]"
      />
    </UPageSection>

    <UPageSection
      id="how-it-works"
      title="How selling works"
      description="Three steps from signup to your first sale."
      :features="howItWorks"
    />

    <UPageSection>
      <UPageCTA
        title="Ready to start selling?"
        description="Open your shop for free and list your first product in minutes."
        variant="subtle"
        :links="[{ label: 'Start selling', to: sellCta, trailingIcon: 'i-lucide-arrow-right', color: 'primary' }]"
      />
    </UPageSection>
  </div>
</template>
