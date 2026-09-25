import { vi } from 'vitest'

// Stand-ins for the Nitro auto-imports the pure server/utils modules call, so they can be
// unit-tested without booting a server. Mutate `runtimeConfig` per test; it's reset before each.
const baseConfig = () => ({
	session: { password: 'x'.repeat(32) },
	stripe: { secretKey: '', apiBase: '' },
	resend: { apiKey: '' },
	email: { from: '' },
})
export const runtimeConfig = baseConfig()

export function resetRuntimeConfig(): void {
	Object.assign(runtimeConfig, baseConfig())
}

vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)
vi.stubGlobal('createError', (input: { statusCode: number; statusMessage: string }) =>
	Object.assign(new Error(input.statusMessage), input),
)
