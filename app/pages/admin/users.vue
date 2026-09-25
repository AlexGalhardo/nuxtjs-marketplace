<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'dashboard', middleware: 'admin' })
useSeoMeta({ title: 'users — admin' })

const filters = useUrlFilters({ q: '', role: 'all', page: 1 })
const query = computed(() => ({
	q: filters.q || undefined,
	role: filters.role === 'all' ? undefined : filters.role,
	page: filters.page,
}))
const { data, status } = await useFetch('/api/admin/users', { query })

type Row = NonNullable<typeof data.value>['data'][number]
const columns: TableColumn<Row>[] = [
	{ accessorKey: 'name', header: 'user' },
	{ accessorKey: 'role', header: 'role' },
	{ accessorKey: 'shopSlug', header: 'shop' },
	{ accessorKey: 'createdAt', header: 'joined' },
]
</script>

<template>
	<div class="space-y-4 p-4 sm:p-6">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<h1 class="text-2xl font-semibold text-highlighted">users</h1>
			<p class="text-sm text-muted tabular-nums">{{ data?.meta.total ?? 0 }} total</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<UInput
				v-model.lazy="filters.q"
				icon="i-lucide-search"
				placeholder="name or email…"
				aria-label="search users"
				class="w-full sm:w-72"
			/>
			<USelect
				v-model="filters.role"
				:items="['all', 'user', 'admin']"
				aria-label="role"
				class="w-32"
			/>
		</div>

		<UTable
			:data="data?.data ?? []"
			:columns="columns"
			:loading="status === 'pending'"
			class="rounded-lg ring-1 ring-default"
		>
			<template #name-cell="{ row }">
				<p class="font-semibold text-highlighted">{{ row.original.name }}</p>
				<p class="text-xs text-muted normal-case">{{ row.original.email }}</p>
			</template>
			<template #role-cell="{ row }">
				<UBadge
					:color="row.original.role === 'admin' ? 'primary' : 'neutral'"
					variant="subtle"
					:label="row.original.role"
				/>
			</template>
			<template #shopSlug-cell="{ row }">
				<NuxtLink
					v-if="row.original.shopSlug"
					:to="`/shops/${row.original.shopSlug}`"
					class="font-mono text-sm normal-case hover:underline"
					:class="row.original.shopStatus === 'suspended' ? 'text-error' : 'text-toned'"
					>{{
						row.original.shopSlug
					}}</NuxtLink
				>
				<span v-else class="text-dimmed">—</span>
			</template>
			<template #createdAt-cell="{ row }">
				<span class="text-muted tabular-nums">{{
					formatDate(row.original.createdAt)
				}}</span>
			</template>
			<template #empty>
				<p class="py-10 text-center text-muted">no users match these filters.</p>
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
