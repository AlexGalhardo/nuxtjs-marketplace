<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { type SignupInput, signupSchema } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth', middleware: 'guest' })

const { signup } = useAuth()
const toast = useToast()
const router = useRouter()
const authForm = useTemplateRef<{ state: { password?: string } }>('authForm')
const pending = ref(false)

const fields: AuthFormField[] = [
	{
		name: 'name',
		type: 'text',
		label: 'Name',
		placeholder: 'Jane Doe',
		required: true,
		autocomplete: 'name',
	},
	{
		name: 'email',
		type: 'email',
		label: 'Email',
		placeholder: 'you@example.com',
		required: true,
		autocomplete: 'email',
	},
	{
		name: 'password',
		type: 'password',
		label: 'Password',
		placeholder: 'Create a password',
		required: true,
		autocomplete: 'new-password',
	},
]

const passwordRules = [
	{ label: '8-32 characters', test: (value: string) => value.length >= 8 && value.length <= 32 },
	{ label: 'One lowercase letter', test: (value: string) => /[a-z]/.test(value) },
	{ label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
	{ label: 'One digit', test: (value: string) => /[0-9]/.test(value) },
	{ label: 'One special character', test: (value: string) => /[^a-zA-Z0-9]/.test(value) },
]

const password = computed(() => authForm.value?.state.password ?? '')

async function onSubmit(event: FormSubmitEvent<SignupInput>) {
	pending.value = true
	try {
		await signup(event.data)
		await router.push('/')
	} catch (error) {
		const statusMessage =
			(error as { data?: { statusMessage?: string } })?.data?.statusMessage ??
			'Something went wrong'
		toast.add({ title: 'Sign up failed', description: statusMessage, color: 'error' })
	} finally {
		pending.value = false
	}
}
</script>

<template>
	<UPageCard class="w-full max-w-md">
		<h1 class="sr-only">Create an account</h1>
		<UAuthForm
			ref="authForm"
			:schema="signupSchema"
			title="Create an account"
			icon="i-lucide-user-plus"
			:fields="fields"
			:loading="pending"
			:submit="{ label: 'Create account' }"
			@submit="onSubmit"
		>
			<template #description>
				<p class="text-sm text-muted">Start buying and selling in minutes.</p>
				<ul class="mt-3 space-y-1" aria-live="polite">
					<li
						v-for="rule in passwordRules"
						:key="rule.label"
						class="flex items-center gap-1.5 text-xs"
						:class="rule.test(password) ? 'text-success' : 'text-muted'"
					>
						<UIcon
							:name="rule.test(password) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
							class="size-3.5 shrink-0"
						/>
						{{ rule.label }}
					</li>
				</ul>
			</template>

			<template #footer>
				<p class="text-sm text-muted text-center">
					Already have an account?
					<ULink to="/login" class="font-medium text-primary">Log in</ULink>
				</p>
			</template>
		</UAuthForm>
	</UPageCard>
</template>
