<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { type ShopUpdateInput, shopUpdateSchema } from '#shared/schemas/shop'
import type { Shop } from '#shared/types/db'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Shop settings — Marketplace' })

const toast = useToast()
const { data: shop, refresh } = await useFetch<Shop | null>('/api/v1/shop')
if (!shop.value) {
  await navigateTo('/my-shop')
}

const state = reactive<ShopUpdateInput>({
  name: shop.value?.name ?? '',
  description: shop.value?.description ?? '',
})

const pending = ref(false)
async function onSubmit(submitEvent: FormSubmitEvent<ShopUpdateInput>) {
  pending.value = true
  try {
    await $fetch('/api/v1/shop', { method: 'PATCH', body: submitEvent.data })
    toast.add({ title: 'Shop updated', color: 'success' })
    await refresh()
  } finally {
    pending.value = false
  }
}

const logoPending = ref(false)
const bannerPending = ref(false)

async function uploadBranding(kind: 'logo' | 'banner', file: File | null) {
  if (!file) return
  const pendingRef = kind === 'logo' ? logoPending : bannerPending
  pendingRef.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    await $fetch(`/api/v1/shop/branding/${kind}`, { method: 'PUT', body: formData })
    toast.add({ title: kind === 'logo' ? 'Logo updated' : 'Banner updated', color: 'success' })
    await refresh()
  } catch {
    toast.add({
      title: 'Upload failed',
      description: 'Check the file type and size.',
      color: 'error',
    })
  } finally {
    pendingRef.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-2xl py-10 space-y-6">
    <h1 class="text-2xl font-semibold">Shop settings</h1>

    <UPageCard title="Branding" description="Shown on your shop page and product cards.">
      <div class="grid gap-6 sm:grid-cols-2">
        <UFormField label="Logo">
          <UFileUpload
            accept="image/*"
            label="Drop a logo here"
            description="PNG or JPG, max 4MB"
            :loading="logoPending"
            @update:model-value="(file) => uploadBranding('logo', file as File | null)"
          />
          <img
            v-if="shop?.logoPath"
            :src="`/${shop.logoPath}`"
            alt="Current shop logo"
            class="mt-3 size-16 rounded-md object-cover"
            width="64"
            height="64"
          >
        </UFormField>
        <UFormField label="Banner">
          <UFileUpload
            accept="image/*"
            label="Drop a banner here"
            description="PNG or JPG, max 4MB"
            :loading="bannerPending"
            @update:model-value="(file) => uploadBranding('banner', file as File | null)"
          />
          <img
            v-if="shop?.bannerPath"
            :src="`/${shop.bannerPath}`"
            alt="Current shop banner"
            class="mt-3 h-16 w-full rounded-md object-cover"
            width="320"
            height="64"
          >
        </UFormField>
      </div>
    </UPageCard>

    <UPageCard title="Shop details">
      <UForm :schema="shopUpdateSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Shop name" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>
        <UFormField label="Description" name="description">
          <UTextarea v-model="state.description" :rows="4" class="w-full" />
        </UFormField>
        <UButton type="submit" :loading="pending">Save changes</UButton>
      </UForm>
    </UPageCard>
  </UContainer>
</template>
