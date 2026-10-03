import { fileURLToPath } from 'node:url'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { defineConfig, devices } from '@playwright/test'
import { FAKE_STRIPE_PORT } from './tests/integration/helpers/fake-stripe'

const isCI = Boolean(process.env.CI)
const port = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://localhost:${port}`

// Set PLAYWRIGHT_SKIP_BUILD=1 when `.output` is already built (CI builds once for smoke + e2e)
// The test database (`.data-test`, see webServer.env) gets the product types before the server starts.
// The QA suite (`bun run test:qa` sets PLAYWRIGHT_QA=1) also needs the load seed (server/db/seed-load.ts).
const seed = process.env.PLAYWRIGHT_QA
	? 'bun run db:seed && bun run db:seed:load'
	: 'bun run db:seed'
const startServer = process.env.PLAYWRIGHT_SKIP_BUILD
	? `${seed} && bun run start`
	: `bun run build && ${seed} && bun run start`

export default defineConfig<ConfigOptions>({
	globalSetup: './tests/e2e/global-setup.ts',
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
		// QA / pentest suite (docs/testing.md): crawl, fuzzing, authZ matrix, abuse, money, emails.
		{ name: 'qa', testDir: './tests/qa', use: { ...devices['Desktop Chrome'] } },
	],
	webServer: {
		command: startServer,
		url: `${baseURL}/api/health`,
		reuseExistingServer: !isCI,
		timeout: 300_000,
		env: {
			// Own database (nuxt.config.ts `hub.dir`), product types only: e2e data stays out of `.data`.
			NUXT_HUB_DIR: '.data-test',
			SEED_DEMO_CATALOG: 'false',
			PORT: String(port),
			NUXT_STRICT_ENV: 'false',
			NUXT_PUBLIC_SITE_URL: baseURL,
			// nuxt-auth-utils' dev-only auto-generated password fallback does not apply to this
			// production build (docs/testing.md).
			NUXT_SESSION_PASSWORD: 'x'.repeat(32),
			// Fake Stripe (tests/e2e/global-setup.ts); the webhook secret is shared with checkout.spec.ts.
			NUXT_STRIPE_SECRET_KEY: 'sk_test_fake',
			NUXT_STRIPE_WEBHOOK_SECRET: 'whsec_test_integration',
			NUXT_STRIPE_API_BASE: `http://127.0.0.1:${FAKE_STRIPE_PORT}`,
			// Contact form mails go somewhere, and every logged mail lands in the QA outbox (server/utils/mail.ts).
			NUXT_CONTACT_EMAIL: 'contact@qa.resell.test',
			MAIL_OUTBOX_FILE: '.data-test/mail-outbox.jsonl',
		},
	},
})
