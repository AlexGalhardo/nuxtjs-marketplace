<script setup lang="ts">
import { type ProductInput, productSchema } from '#shared/schemas/product'
import type { Product, ProductType } from '#shared/types/db'

definePageMeta({ layout: 'my-shop', middleware: 'auth' })
useSeoMeta({ title: 'New product — Marketplace' })

const toast = useToast()
const router = useRouter()
const { data: productTypes } = await useFetch<ProductType[]>('/api/product-types')

const state = reactive<ProductInput>({
	productTypeId: '',
	title: '',
	slug: '',
	description: '',
	priceCents: 0,
	shippingCents: 0,
	stock: 0,
})

const slugEditedManually = ref(false)
watch(
	() => state.title,
	(title) => {
		if (!slugEditedManually.value) state.slug = slugify(title)
	},
)
watch(
	() => state.slug,
	() => {
		slugEditedManually.value = true
	},
)

const pending = ref(false)
async function onSubmit(data: ProductInput) {
	pending.value = true
	try {
		const product = await $fetch<Product>('/api/v1/shop/products', {
			method: 'POST',
			body: data,
		})
		toast.add({
			title: 'Product created',
			description: 'Add photos before publishing.',
			color: 'success',
		})
		await router.push(`/my-shop/products/${product.id}/edit`)
	} catch (error) {
		const statusMessage =
			(error as { data?: { statusMessage?: string } })?.data?.statusMessage ??
			'Something went wrong'
		toast.add({ title: 'Could not create product', description: statusMessage, color: 'error' })
	} finally {
		pending.value = false
	}
}
</script>

<template>
	<UContainer class="max-w-2xl py-10 space-y-6">
		<h1 class="text-2xl font-semibold">New product</h1>

		<UPageCard>
			<ProductForm
				:schema="productSchema"
				:state="state"
				:product-types="productTypes ?? []"
				show-slug
				:loading="pending"
				submit-label="Create product"
				@submit="onSubmit"
			/>
		</UPageCard>
	</UContainer>
</template>
