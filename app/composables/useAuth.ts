import type { LoginInput, SignupInput } from '#shared/schemas/auth'

export function useAuth() {
	const session = useUserSession()

	async function signup(payload: SignupInput) {
		await $fetch('/api/auth/signup', { method: 'POST', body: payload })
		await session.fetch()
	}

	async function login(payload: LoginInput) {
		await $fetch('/api/auth/login', { method: 'POST', body: payload })
		await session.fetch()
	}

	async function logout() {
		await $fetch('/api/auth/logout', { method: 'POST' })
		await session.fetch()
	}

	return {
		loggedIn: session.loggedIn,
		user: session.user,
		signup,
		login,
		logout,
	}
}
