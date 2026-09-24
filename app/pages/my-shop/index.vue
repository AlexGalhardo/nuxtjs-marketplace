<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { type ShopInput, shopSchema } from '#shared/schemas/shop'
import type { Shop } from '#shared/types/db'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'My shop — Marketplace' })

const toast = useToast()
const { data: shop, refresh } = await useFetch<Shop | null>('/api/v1/shop')

const state = reactive<ShopInput>({ name: '', slug: '', description: '' })
const slugEditedManually = ref(false)
watch(
  () => state.name,
  (name) => {
    if (!slugEditedManually.value) state.slug = slugify(name)
  },
)

const pending = ref(false)
async function onSubmit(submitEvent: FormSubmitEvent<ShopInput>) {
  pending.value = true
  try {
    await $fetch('/api/v1/shop', { method: 'POST', body: submitEvent.data })
    toast.add({ title: 'Shop created', color: 'success' })
    await refresh()
  } catch (error) {
    const statusMessage =
      (error as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Something went wrong'
    toast.add({ title: 'Could not create shop', description: statusMessage, color: 'error' })
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-3xl py-10 space-y-6">
    <h1 class="text-2xl font-semibold">My shop</h1>

    <UPageCard
      v-if="!shop"
      title="Create your shop"
      description="Pick a name and URL. You can add a logo, banner and connect Stripe afterwards."
    >
      <UForm :schema="shopSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Shop name" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>
        <UFormField
          label="Shop URL"
          name="slug"
          required
          description="marketplace.example/shops/your-slug"
        >
          <UInput v-model="state.slug" class="w-full" @input="slugEditedManually = true" />
        </UFormField>
        <UFormField label="Description" name="description">
          <UTextarea v-model="state.description" :rows="4" class="w-full" />
        </UFormField>
        <UButton type="submit" :loading="pending">Create shop</UButton>
      </UForm>
    </UPageCard>

    <template v-else>
      <UPageCard :title="shop.name" :description="shop.description ?? undefined">
        <template #trailing>
          <UBadge v-if="shop.chargesEnabled" color="success" variant="subtle"
            >Payouts connected</UBadge
          >
          <UBadge v-else color="warning" variant="subtle">Connect Stripe to publish</UBadge>
        </template>
        <p class="text-sm text-muted">/shops/{{ shop.slug }}</p>
      </UPageCard>

      <div class="grid gap-4 sm:grid-cols-3">
        <UPageCard title="Products" icon="i-lucide-package" to="/my-shop/products" spotlight />
        <UPageCard title="Payouts" icon="i-lucide-banknote" to="/my-shop/payouts" spotlight />
        <UPageCard title="Settings" icon="i-lucide-settings" to="/my-shop/settings" spotlight />
      </div>
    </template>
  </UContainer>
</template>
