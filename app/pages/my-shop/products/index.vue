<script setup lang="ts">
import type { Product } from '#shared/types/db'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'Products — Marketplace' })

interface ProductsResponse {
  data: Product[]
  meta: { page: number; perPage: number; total: number }
}

const toast = useToast()
const {
  data: response,
  refresh,
  status,
} = await useFetch<ProductsResponse>('/api/v1/shop/products')

const statusColor: Record<Product['status'], 'neutral' | 'success' | 'warning'> = {
  draft: 'neutral',
  published: 'success',
  archived: 'neutral',
  suspended: 'warning',
}

const actionPending = ref<string | null>(null)

async function publish(product: Product) {
  actionPending.value = product.id
  try {
    await $fetch(`/api/v1/shop/products/${product.id}/publish`, { method: 'POST' })
    await refresh()
  } catch (error) {
    const statusMessage =
      (error as { data?: { statusMessage?: string } })?.data?.statusMessage ??
      'Something went wrong'
    toast.add({ title: 'Could not publish', description: statusMessage, color: 'error' })
  } finally {
    actionPending.value = null
  }
}

async function archive(product: Product) {
  actionPending.value = product.id
  try {
    await $fetch(`/api/v1/shop/products/${product.id}/archive`, { method: 'POST' })
    await refresh()
  } finally {
    actionPending.value = null
  }
}

const deletingProduct = ref<Product | null>(null)
const deletePending = ref(false)
async function deleteProduct() {
  if (!deletingProduct.value) return
  deletePending.value = true
  try {
    await $fetch(`/api/v1/shop/products/${deletingProduct.value.id}`, { method: 'DELETE' })
    deletingProduct.value = null
    await refresh()
  } finally {
    deletePending.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-3xl py-10 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Products</h1>
      <UButton to="/my-shop/products/new" icon="i-lucide-plus">New product</UButton>
    </div>

    <div v-if="status === 'pending'" class="space-y-3">
      <USkeleton v-for="n in 3" :key="n" class="h-20 w-full" />
    </div>

    <UAlert
      v-else-if="!response?.data.length"
      icon="i-lucide-package"
      title="No products yet"
      description="Create your first product to start selling."
      :actions="[{ label: 'New product', to: '/my-shop/products/new' }]"
    />

    <ul v-else class="space-y-3">
      <li
        v-for="product in response.data"
        :key="product.id"
        class="flex items-center justify-between gap-4 rounded-lg border border-default p-4"
      >
        <div class="min-w-0">
          <p class="font-medium truncate">
            {{ product.title }}
            <UBadge :color="statusColor[product.status]" variant="subtle" size="sm" class="ml-1">
              {{ product.status }}
            </UBadge>
          </p>
          <p class="text-sm text-muted">{{ formatMoney(product.priceCents) }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <UButton
            v-if="product.status === 'draft' || product.status === 'archived'"
            size="sm"
            variant="subtle"
            :loading="actionPending === product.id"
            @click="publish(product)"
          >
            Publish
          </UButton>
          <UButton
            v-else-if="product.status === 'published'"
            size="sm"
            color="neutral"
            variant="subtle"
            :loading="actionPending === product.id"
            @click="archive(product)"
          >
            Unpublish
          </UButton>
          <UButton
            :to="`/my-shop/products/${product.id}/edit`"
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
            aria-label="Edit product"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            aria-label="Delete product"
            @click="deletingProduct = product"
          />
        </div>
      </li>
    </ul>

    <UModal :open="!!deletingProduct" title="Delete product" @update:open="deletingProduct = null">
      <template #body>
        <p class="text-sm text-muted">
          Delete <strong>{{ deletingProduct?.title }}</strong>? This can’t be undone.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <UButton color="neutral" variant="subtle" @click="deletingProduct = null">Cancel</UButton>
          <UButton color="error" :loading="deletePending" @click="deleteProduct"
            >Delete product</UButton
          >
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
