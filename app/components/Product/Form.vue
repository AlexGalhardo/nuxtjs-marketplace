<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ZodType } from 'zod'
import type { ProductInput } from '#shared/schemas/product'
import type { ProductType } from '#shared/types/db'

const props = defineProps<{
	schema: ZodType
	state: ProductInput
	productTypes: ProductType[]
	showSlug: boolean
	loading: boolean
	submitLabel: string
}>()

const emit = defineEmits<{ submit: [ProductInput] }>()

const categoryItems = computed(() =>
	props.productTypes.map((type) => ({ label: `${type.name} (${type.kind})`, value: type.id })),
)

const selectedKind = computed(
	() => props.productTypes.find((type) => type.id === props.state.productTypeId)?.kind,
)

function onSubmit(event: FormSubmitEvent<unknown>) {
	emit('submit', event.data as ProductInput)
}
</script>

<template>
	<UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
		<UFormField label="Category" name="productTypeId" required>
			<USelectMenu
				v-model="state.productTypeId"
				:items="categoryItems"
				value-key="value"
				placeholder="Select a category…"
				class="w-full"
			/>
		</UFormField>
		<UFormField label="Title" name="title" required>
			<UInput v-model="state.title" class="w-full" />
		</UFormField>
		<UFormField
			v-if="showSlug"
			label="Product URL"
			name="slug"
			required
			description="marketplace.example/products/your-slug"
		>
			<UInput v-model="state.slug" class="w-full" />
		</UFormField>
		<UFormField label="Description" name="description" required>
			<UTextarea v-model="state.description" :rows="6" class="w-full" />
		</UFormField>
		<UFormField
			label="Price (cents)"
			name="priceCents"
			required
			:description="`= ${formatMoney(state.priceCents || 0)}`"
		>
			<UInput v-model="state.priceCents" type="number" min="1" class="w-full" />
		</UFormField>
		<template v-if="selectedKind === 'physical'">
			<UFormField
				label="Shipping fee (cents)"
				name="shippingCents"
				:description="`= ${formatMoney(state.shippingCents || 0)}`"
			>
				<UInput v-model="state.shippingCents" type="number" min="0" class="w-full" />
			</UFormField>
			<UFormField label="Stock" name="stock">
				<UInput v-model="state.stock" type="number" min="0" class="w-full" />
			</UFormField>
		</template>
		<UButton type="submit" :loading="loading">{{ submitLabel }}</UButton>
	</UForm>
</template>
