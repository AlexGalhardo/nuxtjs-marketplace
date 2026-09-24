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
		coverage: {
			provider: 'v8',
			include: ['shared/**/*.ts', 'server/utils/**/*.ts'],
			reporter: ['text', 'html', 'lcov'],
		},
	},
})
