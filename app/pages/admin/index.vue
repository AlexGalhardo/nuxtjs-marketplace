<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'admin' })
useSeoMeta({ title: 'admin' })

const [{ data: stats }, { data: audit, status: auditStatus }] = await Promise.all([
	useFetch('/api/admin/stats'),
	useFetch('/api/admin/audit-logs', { query: { perPage: 15 } }),
])

const actionLabel: Record<string, string> = {
	'shop.suspended': 'suspended shop',
	'shop.reinstated': 'reinstated shop',
	'product.suspended': 'suspended product',
	'product.reinstated': 'reinstated product',
	'transaction_logs.exported': 'exported transaction logs',
}

function reasonOf(metadata: unknown): string | null {
	const reason = (metadata as { reason?: unknown } | null)?.reason
	return typeof reason === 'string' ? reason : null
}
</script>

<template>
	<div class="space-y-8 p-4 sm:p-6">
		<h1 class="text-2xl font-semibold text-highlighted">admin</h1>

		<!-- The whole marketplace on one status line, like `top` for the shop floor. -->
		<dl
			v-if="stats"
			class="flex flex-wrap gap-x-8 gap-y-4 rounded-lg bg-muted px-5 py-4 font-mono text-sm"
		>
			<div>
				<dt class="text-muted">gross paid</dt>
				<dd class="text-2xl font-semibold text-highlighted tabular-nums">
					{{ formatMoney(stats.grossCents) }}
				</dd>
			</div>
			<div>
				<dt class="text-muted">paid orders</dt>
				<dd class="text-2xl font-semibold text-highlighted tabular-nums">
					{{ stats.paidOrders }}
				</dd>
			</div>
			<div>
				<dt class="text-muted">live listings</dt>
				<dd class="text-2xl font-semibold text-highlighted tabular-nums">
					{{ stats.publishedProducts }}
				</dd>
			</div>
			<div>
				<dt class="text-muted">shops</dt>
				<dd class="text-2xl font-semibold text-highlighted tabular-nums">
					{{ stats.shops }}
				</dd>
			</div>
			<div>
				<dt class="text-muted">users</dt>
				<dd class="text-2xl font-semibold text-highlighted tabular-nums">
					{{ stats.users }}
				</dd>
			</div>
		</dl>

		<div
			v-if="stats && (stats.suspendedShops || stats.suspendedProducts)"
			class="flex flex-wrap gap-2 text-sm"
		>
			<UButton
				v-if="stats.suspendedShops"
				to="/admin/shops?status=suspended"
				color="error"
				variant="subtle"
				size="sm"
				icon="i-lucide-store"
				>{{ stats.suspendedShops }}
				suspended
				{{ stats.suspendedShops === 1 ? 'shop' : 'shops' }}</UButton
			>
			<UButton
				v-if="stats.suspendedProducts"
				to="/admin/products?status=suspended"
				color="error"
				variant="subtle"
				size="sm"
				icon="i-lucide-package-x"
				>{{ stats.suspendedProducts }}
				suspended
				{{ stats.suspendedProducts === 1 ? 'listing' : 'listings' }}</UButton
			>
		</div>

		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-highlighted">audit log</h2>
			<div v-if="auditStatus === 'pending'" class="space-y-2">
				<USkeleton v-for="n in 4" :key="n" class="h-10 w-full" />
			</div>
			<p v-else-if="!audit?.data.length" class="rounded-lg bg-muted px-5 py-8 text-muted">
				no admin actions yet. suspensions and exports show up here.
			</p>
			<ol v-else class="divide-y divide-default rounded-lg ring-1 ring-default">
				<li
					v-for="entry in audit.data"
					:key="entry.id"
					class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
				>
					<span class="font-mono text-xs text-muted tabular-nums">{{
						formatDate(entry.createdAt)
					}}</span>
					<span class="text-highlighted">
						<strong class="font-semibold">{{
							entry.actorName ?? 'deleted user'
						}}</strong>
						{{ actionLabel[entry.action] ?? entry.action }}
						<span
							v-if="entry.targetId"
							class="font-mono text-xs text-toned normal-case"
							>{{
								entry.targetId
							}}</span
						>
					</span>
					<span v-if="reasonOf(entry.metadata)" class="w-full text-muted sm:w-auto">
						“{{ reasonOf(entry.metadata) }}”
					</span>
				</li>
			</ol>
		</section>
	</div>
</template>
