import { fileURLToPath } from 'node:url'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)
const port = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://localhost:${port}`

// Set PLAYWRIGHT_SKIP_BUILD=1 when `.output` is already built (CI builds once for smoke + e2e)
const startServer = process.env.PLAYWRIGHT_SKIP_BUILD
	? 'bun run start'
	: 'bun run build && bun run start'

export default defineConfig<ConfigOptions>({
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
		nuxt: {
			rootDir: fileURLToPath(new URL('.', import.meta.url)),
			host: baseURL,
		},
	},
	projects: [
		{ name: 'smoke', testDir: './tests/smoke', use: { ...devices['Desktop Chrome'] } },
		{ name: 'e2e', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'] } },
	],
	webServer: {
		command: startServer,
		url: `${baseURL}/api/health`,
		reuseExistingServer: !isCI,
		timeout: 300_000,
		env: {
			PORT: String(port),
			NUXT_STRICT_ENV: 'false',
			NUXT_PUBLIC_SITE_URL: baseURL,
			// nuxt-auth-utils' dev-only auto-generated password fallback does not apply to this
			// production build (docs/testing.md).
			NUXT_SESSION_PASSWORD: 'x'.repeat(32),
		},
	},
})
