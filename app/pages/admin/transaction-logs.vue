<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'dashboard', middleware: 'admin' })
useSeoMeta({ title: 'transaction logs — admin' })

const filters = useUrlFilters({
	type: 'all',
	status: '',
	orderId: '',
	shopId: '',
	from: '',
	to: '',
	page: 1,
})
// Only set filters go in the query string, so the export link mirrors the table exactly.
const filterQuery = computed(() => {
	const { page: _page, type, ...rest } = filters
	const entries = Object.entries({ ...rest, type: type === 'all' ? '' : type })
	return Object.fromEntries(entries.filter(([, value]) => value.trim() !== ''))
})
const query = computed(() => ({ ...filterQuery.value, page: filters.page }))
const { data, status, error } = await useFetch('/api/admin/transaction-logs', { query })
const exportUrl = computed(() => {
	const params = new URLSearchParams(filterQuery.value).toString()
	const base = '/api/admin/transaction-logs/export'
	return params ? `${base}?${params}` : base
})
const typeItems = computed(() => ['all', ...(data.value?.types ?? [])])
const hasFilters = computed(() => Object.keys(filterQuery.value).length > 0)
function clearFilters() {
	Object.assign(filters, { type: 'all', status: '', orderId: '', shopId: '', from: '', to: '' })
}

type Row = NonNullable<typeof data.value>['data'][number]
const columns: TableColumn<Row>[] = [
	{ accessorKey: 'createdAt', header: 'when (utc)' },
	{ accessorKey: 'type', header: 'type' },
	{
		accessorKey: 'amountCents',
		header: () => h('span', { class: 'block text-right' }, 'amount'),
	},
	{ accessorKey: 'status', header: 'status' },
	{ accessorKey: 'orderId', header: 'order / shop' },
	{ accessorKey: 'stripeObjectId', header: 'stripe' },
]

function timestamp(iso: string) {
	return iso.replace('T', ' ').slice(0, 19)
}
</script>

<template>
	<div class="space-y-4 p-4 sm:p-6">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-2xl font-semibold text-highlighted">transaction logs</h1>
				<p class="mt-1 text-sm text-muted">
					every money event, append-only.
					<span class="tabular-nums">{{ data?.meta.total ?? 0 }}</span>
					match.
				</p>
			</div>
			<UButton
				:href="exportUrl"
				external
				icon="i-lucide-download"
				color="neutral"
				variant="subtle"
				>export csv</UButton
			>
		</div>

		<div class="flex flex-wrap items-end gap-2">
			<UFormField label="type" size="sm">
				<USelect v-model="filters.type" :items="typeItems" class="w-48" />
			</UFormField>
			<UFormField label="status" size="sm">
				<UInput v-model.lazy="filters.status" placeholder="succeeded…" class="w-32" />
			</UFormField>
			<UFormField label="order id" size="sm">
				<UInput v-model.lazy="filters.orderId" class="w-40" :ui="{ base: 'font-mono' }" />
			</UFormField>
			<UFormField label="shop id" size="sm">
				<UInput v-model.lazy="filters.shopId" class="w-40" :ui="{ base: 'font-mono' }" />
			</UFormField>
			<UFormField label="from" size="sm">
				<UInput v-model="filters.from" type="date" class="w-40" />
			</UFormField>
			<UFormField label="to" size="sm">
				<UInput v-model="filters.to" type="date" class="w-40" />
			</UFormField>
			<UButton
				v-if="hasFilters"
				color="neutral"
				variant="ghost"
				size="sm"
				@click="clearFilters"
				>clear</UButton
			>
		</div>

		<UAlert
			v-if="error"
			color="error"
			variant="subtle"
			icon="i-lucide-triangle-alert"
			title="those filters don’t work"
			:description="apiErrorMessage(error)"
		/>

		<UTable
			v-else
			:data="data?.data ?? []"
			:columns="columns"
			:loading="status === 'pending'"
			class="rounded-lg ring-1 ring-default"
			:ui="{ td: 'py-2' }"
		>
			<template #createdAt-cell="{ row }">
				<span class="font-mono text-xs text-muted tabular-nums">{{
					timestamp(row.original.createdAt)
				}}</span>
			</template>
			<template #type-cell="{ row }">
				<span class="font-mono text-sm text-highlighted normal-case">{{
					row.original.type
				}}</span>
			</template>
			<template #amountCents-cell="{ row }">
				<span class="block text-right font-mono tabular-nums text-highlighted">{{
					formatMoney(row.original.amountCents)
				}}</span>
			</template>
			<template #status-cell="{ row }">
				<span
					class="font-mono text-xs normal-case"
					:class="/fail|disput/.test(row.original.status) ? 'text-error' : 'text-toned'"
					>{{
						row.original.status
					}}</span
				>
			</template>
			<template #orderId-cell="{ row }">
				<button
					v-if="row.original.orderId"
					type="button"
					class="block font-mono text-xs text-toned normal-case hover:text-primary"
					:title="`filter by order ${row.original.orderId}`"
					@click="filters.orderId = row.original.orderId ?? ''"
				>
					{{ row.original.orderId }}
				</button>
				<button
					v-if="row.original.shopId"
					type="button"
					class="block font-mono text-xs text-muted normal-case hover:text-primary"
					:title="`filter by shop ${row.original.shopId}`"
					@click="filters.shopId = row.original.shopId ?? ''"
				>
					{{ row.original.shopId }}
				</button>
			</template>
			<template #stripeObjectId-cell="{ row }">
				<span class="font-mono text-xs text-muted normal-case">{{
					row.original.stripeObjectId ?? '—'
				}}</span>
			</template>
			<template #empty>
				<p class="py-10 text-center text-muted">
					{{ hasFilters ? 'nothing matches these filters.' : 'no money has moved yet.' }}
				</p>
			</template>
		</UTable>

		<div v-if="(data?.meta.total ?? 0) > (data?.meta.perPage ?? 25)" class="flex justify-end">
			<UPagination
				v-model:page="filters.page"
				:total="data?.meta.total"
				:items-per-page="data?.meta.perPage"
			/>
		</div>
	</div>
</template>
