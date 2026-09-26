import { type ChildProcess, spawn } from 'node:child_process'
import type { Server } from 'node:http'
import { createTestContext, exposeContextToEnv, setTestContext } from '@nuxt/test-utils/e2e'
import { FAKE_STRIPE_PORT, startFakeStripe } from './helpers/fake-stripe'

// Builds and boots the Nuxt server exactly once for the whole `integration` Vitest project,
// instead of once per test file (each build took ~2-3 minutes; with 8 files that was ~20
// minutes). `exposeContextToEnv()` serializes the running server's URL into NUXT_TEST_CONTEXT,
// which every test file's worker process picks up automatically the first time it calls
// `fetch`/`$fetch` from '@nuxt/test-utils/e2e' (see `recoverContextFromEnv` in that package) —
// so individual test files no longer call `setup()` themselves.
//
// This does NOT use `@nuxt/test-utils/e2e`'s own `createTest()`/`startServer()` — under Vitest's
// globalSetup, that combination reliably killed the whole `vitest` process with no error output
// right after the Nitro build finished (reproduced with and without `bun --bun`; the identical
// build+spawn logic ran fine as a plain standalone script, so the failure is specific to running
// it inside Vitest's globalSetup module loader). Building and spawning the server by hand with
// plain `node:child_process` — the same approach `playwright.config.ts`'s `webServer` already
// uses successfully for smoke/e2e — sidesteps that incompatibility.
const PORT = 3101
const BASE_URL = `http://127.0.0.1:${PORT}/`
const ENTRY = '.output/server/index.mjs'

// NUXT_AUTH_RATE_LIMIT_TOKENS (nuxt.config.ts): all integration test files now share one
// server/IP instead of one server per file, and together they legitimately sign up well past the
// production 30/5min auth rate limit — raise it for this build. It is read at build time (routeRules
// are baked into the Nitro build), so it must be set on the build step too, not just the server.
const TEST_ENV = {
	// Own database and blob dir (nuxt.config.ts `hub.dir`): test data never touches `.data`.
	NUXT_HUB_DIR: '.data-test',
	NUXT_STRICT_ENV: 'false',
	NUXT_SESSION_PASSWORD: 'x'.repeat(32),
	NUXT_AUTH_RATE_LIMIT_TOKENS: '1000',
	NUXT_RATE_LIMIT_TOKENS: '100000',
	// Checkout/webhook tests: Stripe SDK talks to ./helpers/fake-stripe.ts; payloads are signed with
	// this secret by the tests (tests/integration/helpers/webhook.ts).
	NUXT_STRIPE_SECRET_KEY: 'sk_test_fake',
	NUXT_STRIPE_WEBHOOK_SECRET: 'whsec_test_integration',
	NUXT_STRIPE_API_BASE: `http://127.0.0.1:${FAKE_STRIPE_PORT}`,
}

let server: ChildProcess | undefined
let fakeStripe: Server | undefined

async function runBuild(): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		// No `shell: true`: on Windows that spawns cmd.exe as an intermediary, and killing the
		// returned ChildProcess only kills that shell, orphaning the real `bun` process underneath
		// (the cause of repeated `EADDRINUSE` on this port across otherwise-independent runs).
		// `bun` resolves directly via PATH without a shell.
		const build = spawn('bun', ['run', 'build'], {
			stdio: 'inherit',
			env: { ...process.env, ...TEST_ENV },
		})
		build.on('error', reject)
		build.on('exit', (code) => {
			if (code === 0) resolve()
			else reject(new Error(`bun run build exited with code ${code}`))
		})
	})
}

function startServer(): ChildProcess {
	const child = spawn('bun', [ENTRY], {
		stdio: 'pipe',
		env: {
			...process.env,
			PORT: String(PORT),
			HOST: '127.0.0.1',
			NODE_ENV: 'test',
			...TEST_ENV,
		},
	})
	let output = ''
	child.stdout?.on('data', (chunk) => {
		output += chunk.toString()
	})
	child.stderr?.on('data', (chunk) => {
		output += chunk.toString()
	})
	child.on('exit', (code) => {
		if (code !== null && code !== 0) {
			console.error(
				`[tests/integration/global-setup] server exited early (code ${code})\n${output}`,
			)
		}
	})
	return child
}

async function waitForHealth(child: ChildProcess, deadline: number): Promise<void> {
	while (Date.now() < deadline) {
		// Fail fast instead of polling until the deadline (and possibly getting a healthy response
		// from an unrelated stale process still squatting on the port — see EADDRINUSE note above).
		if (child.exitCode !== null || child.signalCode !== null) {
			throw new Error(
				`Integration test server exited before becoming healthy (code ${child.exitCode}, signal ${child.signalCode})`,
			)
		}
		try {
			const response = await fetch(new URL('/api/health', BASE_URL))
			if (response.ok) return
		} catch {
			// Server not accepting connections yet — retry.
		}
		await new Promise((resolve) => setTimeout(resolve, 200))
	}
	throw new Error(
		`Integration test server did not become healthy within the deadline (${BASE_URL})`,
	)
}

// Nitro lazily dynamic-imports each route handler's chunk on its first request. Hitting one
// representative route per top-level API area here, before any test runs, avoids every test
// file needing its own version of this warmup (previously only auth.test.ts had one, and only
// for /api/auth/reset-password — see its comment for the failure mode this works around).
// Skips /api/contact: its rate limit is tight (5/15min, shared with contact.test.ts's own 3
// calls) and it isn't the route that showed this flake, unlike product-types/shop/auth.
async function warmUpRoutes(): Promise<void> {
	await Promise.all([
		fetch(new URL('/api/product-types', BASE_URL)),
		fetch(new URL('/api/v1/shop', BASE_URL)),
		fetch(new URL('/api/auth/reset-password', BASE_URL), {
			method: 'POST',
			body: JSON.stringify({ token: 'warmup', password: 'Ab1!Ab1!' }),
			headers: { 'content-type': 'application/json' },
		}),
	])
}

// The build applied the migrations to `.data-test`; tests also need the product types.
async function seedProductTypes(): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const seed = spawn('bun', ['run', 'db:seed'], {
			stdio: 'inherit',
			env: { ...process.env, ...TEST_ENV, SEED_DEMO_CATALOG: 'false' },
		})
		seed.on('error', reject)
		seed.on('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`bun run db:seed exited with code ${code}`)),
		)
	})
}

export async function setup() {
	fakeStripe = startFakeStripe()
	await runBuild()
	await seedProductTypes()
	server = startServer()
	await waitForHealth(server, Date.now() + 60_000)
	await warmUpRoutes()

	// `server: false` / `build: false` / `browser: false` make this purely a defaults object —
	// no build, spawn or browser launch happens here (that already happened above by hand).
	const ctx = createTestContext({ server: false, build: false, browser: false })
	ctx.url = BASE_URL
	setTestContext(ctx)
	exposeContextToEnv()
}

export async function teardown() {
	fakeStripe?.close()
	if (!server || server.exitCode !== null || server.signalCode !== null) return
	await new Promise<void>((resolve) => {
		server?.once('exit', () => resolve())
		server?.kill()
		// Belt and braces: don't let a stuck child process hang the whole Vitest run.
		setTimeout(resolve, 5000)
	})
}
