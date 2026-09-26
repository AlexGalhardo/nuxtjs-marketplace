<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { type LoginInput, loginSchema } from '#shared/schemas/auth'

definePageMeta({ middleware: 'guest' })

const { login } = useAuth()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const pending = ref(false)

const fields: AuthFormField[] = [
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
		placeholder: 'Enter your password',
		required: true,
		autocomplete: 'current-password',
	},
]

async function onSubmit(event: FormSubmitEvent<LoginInput>) {
	pending.value = true
	try {
		await login(event.data)
		const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
		await router.push(redirect)
	} catch {
		toast.add({
			title: 'Login failed',
			description: 'Invalid email or password.',
			color: 'error',
		})
	} finally {
		pending.value = false
	}
}
</script>

<template>
	<div class="rs-container flex justify-center py-12 sm:py-16">
		<UPageCard class="w-full max-w-md rounded-none">
			<h1 class="sr-only">Log in</h1>
			<UAuthForm
				:schema="loginSchema"
				title="Log in"
				description="Enter your credentials to access your account."
				icon="i-lucide-user"
				:fields="fields"
				:loading="pending"
				:submit="{ label: 'Log in', class: 'rounded-none' }"
				@submit="onSubmit"
			>
				<template #footer>
					<div class="space-y-2 text-center text-sm text-muted">
						<p>
							<ULink to="/forget-password" class="font-medium text-primary"
								>Forgot your password?</ULink
							>
						</p>
						<p>
							Don’t have an account?
							<ULink to="/signup" class="font-medium text-primary">Sign up</ULink>
						</p>
					</div>
				</template>
			</UAuthForm>
		</UPageCard>
	</div>
</template>
