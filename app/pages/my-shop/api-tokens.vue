<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
	type ApiTokenScope,
	apiTokenScopes,
	type CreateApiTokenInput,
	createApiTokenSchema,
} from '#shared/schemas/api-token'

interface ApiTokenRow {
	id: string
	name: string
	prefix: string
	scopes: ApiTokenScope[]
	lastUsedAt: string | null
	expiresAt: string | null
	revokedAt: string | null
	createdAt: string
}

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'api tokens — my shop' })

const toast = useToast()
const { data: tokens, refresh, status } = await useFetch<ApiTokenRow[]>('/api/v1/shop/tokens')

function stateOf(token: ApiTokenRow) {
	if (token.revokedAt) return { label: 'revoked', color: 'neutral' as const }
	if (token.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) {
		return { label: 'expired', color: 'neutral' as const }
	}
	return { label: 'active', color: 'success' as const }
}

const areas = ['shop', 'products', 'orders'] as const
const expiryOptions = [
	{ label: '30 days', value: '30' },
	{ label: '90 days', value: '90' },
	{ label: '1 year', value: '365' },
	{ label: 'never', value: 'never' },
]

const createOpen = ref(false)
const creating = ref(false)
const state = reactive<CreateApiTokenInput>({ name: '', scopes: [], expiresInDays: 90 })
// USelect items can't carry `null`, so the select works on strings and maps back.
const expiry = computed({
	get: () => (state.expiresInDays ? String(state.expiresInDays) : 'never'),
	set: (value: string) => {
		state.expiresInDays = value === 'never' ? null : (Number(value) as 30 | 90 | 365)
	},
})
function openCreate() {
	Object.assign(state, { name: '', scopes: ['products:read', 'orders:read'], expiresInDays: 90 })
	createOpen.value = true
}
function toggleScope(scope: ApiTokenScope, on: boolean | 'indeterminate') {
	const scopes = new Set(state.scopes)
	if (on === true) scopes.add(scope)
	else scopes.delete(scope)
	state.scopes = apiTokenScopes.filter((known) => scopes.has(known))
}

// Shown exactly once, right after creation; never fetched again.
const secret = ref<string | null>(null)
async function create(event: FormSubmitEvent<CreateApiTokenInput>) {
	creating.value = true
	try {
		const created = await $fetch<{ token: string }>('/api/v1/shop/tokens', {
			method: 'POST',
			body: event.data,
		})
		secret.value = created.token
		createOpen.value = false
		await refresh()
	} catch (error) {
		toast.add({
			title: 'could not create the token',
			description: apiErrorMessage(error),
			color: 'error',
		})
	} finally {
		creating.value = false
	}
}

async function copySecret() {
	if (!secret.value) return
	try {
		await navigator.clipboard.writeText(secret.value)
		toast.add({ title: 'copied', color: 'success', icon: 'i-lucide-clipboard-check' })
	} catch {
		toast.add({ title: 'copy failed, select the token and copy it by hand', color: 'warning' })
	}
}

const revoking = ref<ApiTokenRow | null>(null)
const revokeOpen = ref(false)
const revokePending = ref(false)
function openRevoke(token: ApiTokenRow) {
	revoking.value = token
	revokeOpen.value = true
}
async function revoke() {
	if (!revoking.value) return
	revokePending.value = true
	try {
		await $fetch(`/api/v1/shop/tokens/${revoking.value.id}`, { method: 'DELETE' })
		revokeOpen.value = false
		await refresh()
	} catch (error) {
		toast.add({
			title: 'could not revoke',
			description: apiErrorMessage(error),
			color: 'error',
		})
	} finally {
		revokePending.value = false
	}
}
</script>

<template>
	<UContainer class="max-w-3xl space-y-6 py-10">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-2xl font-semibold text-highlighted">api tokens</h1>
				<p class="mt-1 text-sm text-muted">
					script your shop with the
					<NuxtLink
						to="/my-shop/api-docs"
						class="font-semibold text-primary hover:underline"
						>rest api</NuxtLink
					>. send a token as
					<code class="font-mono text-toned">Authorization: Bearer …</code>
				</p>
			</div>
			<UButton icon="i-lucide-plus" @click="openCreate">new token</UButton>
		</div>

		<div
			v-if="secret"
			class="rounded-lg bg-(--rs-selected) p-4 text-(--rs-selected-ink)"
			role="status"
		>
			<p class="font-semibold">copy your new token now. you won’t see it again.</p>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<code
					class="min-w-0 flex-1 rounded-md bg-default px-3 py-2 font-mono text-sm break-all text-highlighted select-all"
					>{{
						secret
					}}</code
				>
				<UButton icon="i-lucide-clipboard" @click="copySecret">copy</UButton>
				<UButton color="neutral" variant="ghost" @click="secret = null">done</UButton>
			</div>
		</div>

		<div v-if="status === 'pending'" class="space-y-3">
			<USkeleton v-for="n in 2" :key="n" class="h-20 w-full" />
		</div>

		<div v-else-if="!tokens?.length" class="rounded-xl bg-muted px-6 py-14 text-center">
			<UIcon name="i-lucide-key-round" class="size-10 text-dimmed" />
			<p class="mt-3 text-lg font-semibold text-highlighted">no tokens yet</p>
			<p class="mt-1 text-muted">
				create one to manage products and orders from your own scripts.
			</p>
		</div>

		<ul v-else class="divide-y divide-default rounded-lg ring-1 ring-default">
			<li
				v-for="token in tokens"
				:key="token.id"
				class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4"
				:class="stateOf(token).label !== 'active' && 'opacity-60'"
			>
				<div class="min-w-0">
					<p class="flex flex-wrap items-center gap-2 font-semibold text-highlighted">
						{{ token.name }}
						<span class="font-mono text-sm font-medium text-muted"
							>{{ token.prefix }}_…</span
						>
						<UBadge
							:color="stateOf(token).color"
							variant="subtle"
							size="sm"
							:label="stateOf(token).label"
						/>
					</p>
					<p class="mt-1 flex flex-wrap gap-1">
						<span
							v-for="scope in token.scopes"
							:key="scope"
							class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-toned"
							>{{
								scope
							}}</span
						>
					</p>
					<p class="mt-1 text-xs text-muted">
						{{
							token.lastUsedAt ? `last used ${formatDate(token.lastUsedAt)}` : 'never used'
						}}
						·
						{{
							token.expiresAt ? `expires ${formatDate(token.expiresAt)}` : 'no expiry'
						}}
					</p>
				</div>
				<UButton
					v-if="stateOf(token).label === 'active'"
					size="sm"
					color="error"
					variant="ghost"
					@click="openRevoke(token)"
					>revoke</UButton
				>
			</li>
		</ul>

		<UModal v-model:open="createOpen" title="new api token">
			<template #body>
				<UForm
					:schema="createApiTokenSchema"
					:state="state"
					class="space-y-5"
					@submit="create"
				>
					<UFormField
						label="name"
						name="name"
						description="so you know where it’s used"
						required
					>
						<UInput v-model="state.name" placeholder="inventory sync…" class="w-full" />
					</UFormField>

					<UFormField label="scopes" name="scopes" required>
						<div class="mt-1 grid gap-2">
							<div
								v-for="area in areas"
								:key="area"
								class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2"
							>
								<span class="text-sm font-semibold text-highlighted">{{
									area
								}}</span>
								<span class="flex gap-4">
									<UCheckbox
										v-for="access in ['read', 'write'] as const"
										:key="access"
										:label="access"
										:aria-label="`${area}:${access}`"
										:model-value="state.scopes?.includes(`${area}:${access}`)"
										@update:model-value="(on) => toggleScope(`${area}:${access}`, on)"
									/>
								</span>
							</div>
						</div>
					</UFormField>

					<UFormField label="expires" name="expiresInDays">
						<USelect v-model="expiry" :items="expiryOptions" class="w-40" />
					</UFormField>

					<div class="flex justify-end gap-2">
						<UButton color="neutral" variant="subtle" @click="createOpen = false"
							>cancel</UButton
						>
						<UButton type="submit" :loading="creating">create token</UButton>
					</div>
				</UForm>
			</template>
		</UModal>

		<UModal v-model:open="revokeOpen" title="revoke this token?">
			<template #body>
				<p class="text-sm text-toned">
					anything using
					<strong class="text-highlighted">{{ revoking?.name }}</strong>
					stops working right away. this can’t be undone.
				</p>
				<div class="mt-4 flex justify-end gap-2">
					<UButton color="neutral" variant="subtle" @click="revokeOpen = false"
						>keep it</UButton
					>
					<UButton color="error" :loading="revokePending" @click="revoke"
						>revoke token</UButton
					>
				</div>
			</template>
		</UModal>
	</UContainer>
</template>
