<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { type ForgotPasswordInput, forgotPasswordSchema } from '#shared/schemas/auth'

definePageMeta({ middleware: 'guest' })

const pending = ref(false)
const submitted = ref(false)

const fields: AuthFormField[] = [
	{
		name: 'email',
		type: 'email',
		label: 'Email',
		placeholder: 'you@example.com',
		required: true,
		autocomplete: 'email',
	},
]

async function onSubmit(event: FormSubmitEvent<ForgotPasswordInput>) {
	pending.value = true
	try {
		await $fetch('/api/auth/forgot-password', { method: 'POST', body: event.data })
		submitted.value = true
	} finally {
		pending.value = false
	}
}
</script>

<template>
	<div class="rs-container flex justify-center py-12 sm:py-16">
		<UPageCard class="w-full max-w-md rounded-none">
			<h1 class="sr-only">Forgot your password?</h1>
			<UAlert
				v-if="submitted"
				icon="i-lucide-mail-check"
				title="Check your email"
				description="If an account exists for that email, we’ve sent a link to reset your password. It expires in 1 hour."
			/>
			<UAuthForm
				v-else
				:schema="forgotPasswordSchema"
				title="Forgot your password?"
				description="Enter your email and we’ll send you a reset link."
				icon="i-lucide-key-round"
				:fields="fields"
				:loading="pending"
				:submit="{ label: 'Send reset link', class: 'rounded-none' }"
				@submit="onSubmit"
			>
				<template #footer>
					<p class="text-sm text-muted text-center">
						Remembered your password?
						<ULink to="/login" class="font-medium text-primary">Log in</ULink>
					</p>
				</template>
			</UAuthForm>
		</UPageCard>
	</div>
</template>
