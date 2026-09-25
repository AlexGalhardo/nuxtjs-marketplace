<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'dashboard', middleware: 'admin' })
useSeoMeta({ title: 'shops — admin' })

const toast = useToast()
const route = useRoute()
const filters = reactive({
	q: '',
	status: typeof route.query.status === 'string' ? route.query.status : 'all',
	page: 1,
})
watch([() => filters.q, () => filters.status], () => {
	filters.page = 1
})
const query = computed(() => ({
	q: filters.q || undefined,
	status: filters.status === 'all' ? undefined : filters.status,
	page: filters.page,
}))
const { data, status, refresh } = await useFetch('/api/admin/shops', { query })

type Row = NonNullable<typeof data.value>['data'][number]
const columns: TableColumn<Row>[] = [
	{ accessorKey: 'name', header: 'shop' },
	{ accessorKey: 'ownerEmail', header: 'owner' },
	{ accessorKey: 'products', header: 'products' },
	{ accessorKey: 'status', header: 'status' },
	{ accessorKey: 'createdAt', header: 'opened' },
	{ id: 'actions', header: () => h('span', { class: 'sr-only' }, 'actions') },
]

const target = ref<Row | null>(null)
const modalOpen = ref(false)
const pending = ref(false)
const suspending = computed(() => target.value?.status === 'active')
function moderate(row: Row) {
	target.value = row
	modalOpen.value = true
}
async function confirm(reason: string) {
	if (!target.value) return
	pending.value = true
	try {
		await $fetch(`/api/admin/shops/${target.value.id}`, {
			method: 'PATCH',
			body: { status: suspending.value ? 'suspended' : 'active', reason },
		})
		toast.add({
			title: suspending.value ? 'shop suspended' : 'shop reinstated',
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
			<h1 class="text-2xl font-semibold text-highlighted">shops</h1>
			<p class="text-sm text-muted tabular-nums">{{ data?.meta.total ?? 0 }} total</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<UInput
				v-model.lazy="filters.q"
				icon="i-lucide-search"
				placeholder="name, slug or owner email"
				aria-label="search shops"
				class="w-full sm:w-72"
			/>
			<USelect
				v-model="filters.status"
				:items="['all', 'active', 'suspended']"
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
			<template #name-cell="{ row }">
				<NuxtLink
					:to="`/shops/${row.original.slug}`"
					class="font-semibold text-highlighted hover:underline"
					>{{
						row.original.name
					}}</NuxtLink
				>
				<p class="font-mono text-xs text-muted normal-case">{{ row.original.slug }}</p>
			</template>
			<template #ownerEmail-cell="{ row }">
				<p class="text-highlighted">{{ row.original.ownerName }}</p>
				<p class="text-xs text-muted normal-case">{{ row.original.ownerEmail }}</p>
			</template>
			<template #products-cell="{ row }">
				<span class="tabular-nums">{{ row.original.products }}</span>
			</template>
			<template #status-cell="{ row }">
				<div class="flex flex-wrap gap-1">
					<UBadge
						:color="row.original.status === 'active' ? 'success' : 'error'"
						variant="subtle"
						:label="row.original.status"
					/>
					<UBadge
						v-if="!row.original.chargesEnabled"
						color="neutral"
						variant="outline"
						label="no payouts"
					/>
				</div>
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
						:color="row.original.status === 'active' ? 'error' : 'neutral'"
						variant="ghost"
						@click="moderate(row.original)"
						>{{
							row.original.status === 'active' ? 'suspend' : 'reinstate'
						}}</UButton
					>
				</div>
			</template>
			<template #empty>
				<p class="py-10 text-center text-muted">no shops match these filters.</p>
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
			:title="suspending ? `suspend ${target?.name}?` : `reinstate ${target?.name}?`"
			:description="
				suspending
					? 'the shop and all its listings disappear from the marketplace, carts and checkout right away. existing orders are not touched.'
					: 'the shop and its published listings come back to the marketplace.'
			"
			:confirm-label="suspending ? 'suspend shop' : 'reinstate shop'"
			:danger="suspending"
			:loading="pending"
			@confirm="confirm"
		/>
	</div>
</template>
