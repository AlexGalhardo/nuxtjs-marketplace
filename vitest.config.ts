import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

// Test kinds and conventions: docs/testing.md
export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: 'unit',
					include: ['tests/unit/**/*.test.ts'],
					environment: 'node',
				},
			},
			await defineVitestProject({
				test: {
					name: 'nuxt',
					include: ['tests/nuxt/**/*.test.ts'],
					environment: 'nuxt',
					// setupNuxt() boots a whole Nuxt app in beforeAll: ~15 s cold on Windows, past the 10 s default.
					hookTimeout: 120_000,
				},
			}),
			{
				test: {
					name: 'integration',
					include: ['tests/integration/**/*.test.ts'],
					environment: 'node',
					// One build for the whole project (tests/integration/global-setup.ts), not one per
					// file — files share the same on-disk NuxtHub dir (.data) and SQLite file against that
					// single server, so they still run sequentially to avoid races.
					globalSetup: ['tests/integration/global-setup.ts'],
					fileParallelism: false,
					hookTimeout: 300_000,
					testTimeout: 60_000,
				},
			},
		],
		// `bun run test:coverage` (unit project) enforces ≥ 80% on shared/ + server/utils/ (PLAN.md
		// Phase 12). The excluded modules are DB/Stripe orchestration that only runs inside the built
		// server, so the integration suite (a separate process v8 can't instrument) covers them.
		coverage: {
			provider: 'v8',
			include: ['shared/**/*.ts', 'server/utils/**/*.ts'],
			exclude: [
				'shared/types/**',
				'server/utils/auth.ts',
				'server/utils/cart.ts',
				'server/utils/catalog.ts',
				'server/utils/orders.ts',
			],
			reporter: ['text', 'html', 'lcov'],
			thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
		},
	},
})
