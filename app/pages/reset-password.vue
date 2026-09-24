<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { newPasswordSchema } from '#shared/schemas/auth'

// No `guest` middleware here on purpose: a reset link operates on its own token, not the
// current session, so it must stay reachable even for a visitor who happens to be logged in
// (e.g. an old session in another tab, or someone re-authenticating before discovering the link).
definePageMeta({ layout: 'auth' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { fetch: refreshSession } = useUserSession()
const pending = ref(false)

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const fields: AuthFormField[] = [
	{
		name: 'password',
		type: 'password',
		label: 'New password',
		placeholder: 'Create a new password',
		required: true,
		autocomplete: 'new-password',
	},
]

async function onSubmit(event: FormSubmitEvent<{ password: string }>) {
	pending.value = true
	try {
		await $fetch('/api/auth/reset-password', {
			method: 'POST',
			body: { token: token.value, password: event.data.password },
		})
		toast.add({
			title: 'Password updated',
			description: 'Log in with your new password.',
			color: 'success',
		})
		// The reset request cleared the session server-side; refresh the client's reactive state
		// before navigating, otherwise /login's `guest` middleware still sees the stale logged-in
		// value and bounces back to `/`.
		await refreshSession()
		await router.push('/login')
	} catch {
		toast.add({
			title: 'Reset failed',
			description: 'This link is invalid or has expired.',
			color: 'error',
		})
	} finally {
		pending.value = false
	}
}
</script>

<template>
	<UPageCard class="w-full max-w-md">
		<h1 class="sr-only">Set a new password</h1>
		<UAlert
			v-if="!token"
			color="error"
			icon="i-lucide-triangle-alert"
			title="Invalid link"
			description="This password reset link is missing its token. Request a new one."
		/>
		<UAuthForm
			v-else
			:schema="newPasswordSchema"
			title="Set a new password"
			icon="i-lucide-key-round"
			:fields="fields"
			:loading="pending"
			:submit="{ label: 'Update password' }"
			@submit="onSubmit"
		/>
	</UPageCard>
</template>
