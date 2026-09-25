<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'dashboard', middleware: 'admin' })
useSeoMeta({ title: 'products — admin' })

const toast = useToast()
const filters = useUrlFilters({ q: '', status: 'all', page: 1 })
const query = computed(() => ({
	q: filters.q || undefined,
	status: filters.status === 'all' ? undefined : filters.status,
	page: filters.page,
}))
const { data, status, refresh } = await useFetch('/api/admin/products', { query })

type Row = NonNullable<typeof data.value>['data'][number]
const columns: TableColumn<Row>[] = [
	{ accessorKey: 'title', header: 'product' },
	{ accessorKey: 'shopName', header: 'shop' },
	{ accessorKey: 'priceCents', header: 'price' },
	{ accessorKey: 'status', header: 'status' },
	{ accessorKey: 'createdAt', header: 'listed' },
	{ id: 'actions', header: () => h('span', { class: 'sr-only' }, 'actions') },
]

const statusColor = {
	draft: 'neutral',
	published: 'success',
	archived: 'neutral',
	suspended: 'error',
} as const

const target = ref<Row | null>(null)
const modalOpen = ref(false)
const pending = ref(false)
const suspending = computed(() => target.value?.status !== 'suspended')
function moderate(row: Row) {
	target.value = row
	modalOpen.value = true
}
async function confirm(reason: string) {
	if (!target.value) return
	pending.value = true
	try {
		await $fetch(`/api/admin/products/${target.value.id}`, {
			method: 'PATCH',
			body: { status: suspending.value ? 'suspended' : 'archived', reason },
		})
		toast.add({
			title: suspending.value ? 'listing suspended' : 'listing reinstated as unpublished',
			color: 'success',
		})
		modalOpen.value = false
		await refresh()
	} catch (error) {
		toast.add({
			title: 'that didn’t work',
			description: apiErrorMessage(error),
			color: 'error',
		})
	} finally {
		pending.value = false
	}
}
</script>

<template>
	<div class="space-y-4 p-4 sm:p-6">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<h1 class="text-2xl font-semibold text-highlighted">products</h1>
			<p class="text-sm text-muted tabular-nums">{{ data?.meta.total ?? 0 }} total</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<UInput
				v-model.lazy="filters.q"
				icon="i-lucide-search"
				placeholder="title, slug or shop…"
				aria-label="search products"
				class="w-full sm:w-72"
			/>
			<USelect
				v-model="filters.status"
				:items="['all', 'published', 'draft', 'archived', 'suspended']"
				aria-label="status"
				class="w-36"
			/>
		</div>

		<UTable
			:data="data?.data ?? []"
			:columns="columns"
			:loading="status === 'pending'"
			class="rounded-lg ring-1 ring-default"
		>
			<template #title-cell="{ row }">
				<NuxtLink
					v-if="row.original.status === 'published'"
					:to="`/products/${row.original.slug}`"
					class="font-semibold text-highlighted hover:underline"
					>{{
						row.original.title
					}}</NuxtLink
				>
				<span v-else class="font-semibold text-highlighted">{{ row.original.title }}</span>
				<p class="text-xs text-muted">{{ row.original.kind }}</p>
			</template>
			<template #shopName-cell="{ row }">
				<span>{{ row.original.shopName }}</span>
				<UBadge
					v-if="row.original.shopStatus === 'suspended'"
					color="error"
					variant="outline"
					size="sm"
					label="shop suspended"
					class="ml-1"
				/>
			</template>
			<template #priceCents-cell="{ row }">
				<span class="tabular-nums">{{ formatMoney(row.original.priceCents) }}</span>
			</template>
			<template #status-cell="{ row }">
				<UBadge
					:color="statusColor[row.original.status]"
					variant="subtle"
					:label="row.original.status"
				/>
			</template>
			<template #createdAt-cell="{ row }">
				<span class="text-muted tabular-nums">{{
					formatDate(row.original.createdAt)
				}}</span>
			</template>
			<template #actions-cell="{ row }">
				<div class="flex justify-end">
					<UButton
						size="sm"
						:color="row.original.status === 'suspended' ? 'neutral' : 'error'"
						variant="ghost"
						@click="moderate(row.original)"
						>{{
							row.original.status === 'suspended' ? 'reinstate' : 'suspend'
						}}</UButton
					>
				</div>
			</template>
			<template #empty>
				<p class="py-10 text-center text-muted">no products match these filters.</p>
			</template>
		</UTable>

		<div v-if="(data?.meta.total ?? 0) > (data?.meta.perPage ?? 25)" class="flex justify-end">
			<UPagination
				v-model:page="filters.page"
				:total="data?.meta.total"
				:items-per-page="data?.meta.perPage"
			/>
		</div>

		<AdminModerateModal
			v-model:open="modalOpen"
			:title="suspending ? `suspend ${target?.title}?` : `reinstate ${target?.title}?`"
			:description="
				suspending
					? 'the listing leaves the marketplace and carts right away, and the seller can’t republish it.'
					: 'the listing comes back as unpublished. the seller decides when to publish it again.'
			"
			:confirm-label="suspending ? 'suspend listing' : 'reinstate listing'"
			:danger="suspending"
			:loading="pending"
			@confirm="confirm"
		/>
	</div>
</template>
