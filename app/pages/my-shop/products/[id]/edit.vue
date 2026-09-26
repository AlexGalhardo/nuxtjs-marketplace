<script setup lang="ts">
import { type ProductInput, productSchema } from '#shared/schemas/product'
import type { Product, ProductFile, ProductImage, ProductType } from '#shared/types/db'

definePageMeta({ layout: 'my-shop', middleware: 'auth' })
useSeoMeta({ title: 'Edit product — Marketplace' })

const route = useRoute()
const productId = route.params.id as string
const toast = useToast()

const { data: product, refresh: refreshProduct } = await useFetch<Product>(
	`/api/v1/shop/products/${productId}`,
)
const { data: productTypes } = await useFetch<ProductType[]>('/api/product-types')
const { data: images, refresh: refreshImages } = await useFetch<ProductImage[]>(
	`/api/v1/shop/products/${productId}/images`,
	{ default: () => [] as ProductImage[] },
)

const updateSchema = productSchema.omit({ slug: true })

const state = reactive<ProductInput>({
	productTypeId: '',
	title: '',
	slug: '',
	description: '',
	priceCents: 0,
	shippingCents: 0,
	stock: 0,
})
watch(
	product,
	(value) => {
		if (!value) return
		state.productTypeId = value.productTypeId
		state.title = value.title
		state.slug = value.slug
		state.description = value.description
		state.priceCents = value.priceCents
		state.shippingCents = value.shippingCents
		state.stock = value.stock ?? 0
	},
	{ immediate: true },
)

const pending = ref(false)
async function onSubmit(data: ProductInput) {
	pending.value = true
	try {
		await $fetch(`/api/v1/shop/products/${productId}`, { method: 'PATCH', body: data })
		toast.add({ title: 'Product updated', color: 'success' })
		await refreshProduct()
	} finally {
		pending.value = false
	}
}

const imagesUploading = ref(false)
async function onImagesSelected(files: File[] | null | undefined) {
	const list = files ?? []
	if (!list.length) return
	imagesUploading.value = true
	try {
		const formData = new FormData()
		for (const file of await Promise.all(list.map((file) => shrinkImage(file)))) {
			formData.append('files', file)
		}
		await $fetch(`/api/v1/shop/products/${productId}/images`, {
			method: 'POST',
			body: formData,
		})
		await refreshImages()
	} catch {
		toast.add({
			title: 'Upload failed',
			description: 'Check the file type and size.',
			color: 'error',
		})
	} finally {
		imagesUploading.value = false
	}
}

async function deleteImage(imageId: string) {
	await $fetch(`/api/v1/shop/products/${productId}/images/${imageId}`, { method: 'DELETE' })
	await refreshImages()
}

const filesUploading = ref(false)
const { data: files, refresh: refreshFiles } = await useFetch<ProductFile[]>(
	`/api/v1/shop/products/${productId}/files`,
	{ default: () => [] as ProductFile[] },
)

async function onFilesSelected(selected: File[] | null | undefined) {
	const list = selected ?? []
	if (!list.length) return
	filesUploading.value = true
	try {
		const formData = new FormData()
		for (const file of list) formData.append('files', file)
		await $fetch(`/api/v1/shop/products/${productId}/files`, { method: 'POST', body: formData })
		await refreshFiles()
	} catch {
		toast.add({ title: 'Upload failed', color: 'error' })
	} finally {
		filesUploading.value = false
	}
}

async function deleteFile(fileId: string) {
	await $fetch(`/api/v1/shop/products/${productId}/files/${fileId}`, { method: 'DELETE' })
	await refreshFiles()
}
</script>

<template>
	<UContainer class="max-w-2xl py-10 space-y-6">
		<h1 class="text-2xl font-semibold">Edit product</h1>

		<UPageCard>
			<ProductForm
				:schema="updateSchema"
				:state="state"
				:product-types="productTypes ?? []"
				:show-slug="false"
				:loading="pending"
				submit-label="Save changes"
				@submit="onSubmit"
			/>
		</UPageCard>

		<UPageCard
			title="Photos"
			description="Shown on the product page. First photo is the cover."
		>
			<UFileUpload
				multiple
				accept="image/*"
				label="Drop photos here"
				description="PNG or JPG, max 4MB each"
				:loading="imagesUploading"
				@update:model-value="onImagesSelected"
			/>
			<ul v-if="images?.length" class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
				<li v-for="image in images" :key="image.id" class="relative">
					<img
						:src="`/${image.blobPath}`"
						:alt="image.alt ?? product?.title ?? ''"
						class="aspect-square w-full rounded-md object-cover"
						width="120"
						height="120"
					>
					<UButton
						icon="i-lucide-x"
						size="xs"
						color="error"
						variant="solid"
						class="absolute -right-1 -top-1 rounded-full"
						aria-label="Delete photo"
						@click="deleteImage(image.id)"
					/>
				</li>
			</ul>
		</UPageCard>

		<UPageCard
			v-if="product?.kind === 'digital'"
			title="Digital files"
			description="Delivered to buyers after purchase. Never publicly accessible."
		>
			<UFileUpload
				multiple
				label="Drop files here"
				description="Max 512MB each"
				:loading="filesUploading"
				@update:model-value="onFilesSelected"
			/>
			<ul v-if="files?.length" class="mt-4 space-y-2">
				<li
					v-for="file in files"
					:key="file.id"
					class="flex items-center justify-between gap-3 rounded-md border border-default p-2 text-sm"
				>
					<span class="truncate">{{ file.filename }}</span>
					<UButton
						icon="i-lucide-trash-2"
						size="xs"
						variant="ghost"
						color="error"
						aria-label="Delete file"
						@click="deleteFile(file.id)"
					/>
				</li>
			</ul>
		</UPageCard>
	</UContainer>
</template>
