// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	modules: ['@nuxt/ui', 'nuxt-security', '@nuxthub/core', 'nuxt-auth-utils'],

	devtools: {
		enabled: true,
	},

	// Vue's compiler doesn't list the HTML `<search>` element yet, so it resolved it as a component
	// and rendered "[object Promise]" instead of the header search form.
	vue: {
		compilerOptions: { isCustomElement: (tag) => tag === 'search' },
	},

	// Dialect fixed at build time (D5, docs/database.md). Postgres reads DATABASE_URL;
	// sqlite defaults to a local file at .data/db/sqlite.db. Blob: fs locally, S3 when
	// S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY/S3_BUCKET are set (docker-compose/prod).
	hub: {
		db: process.env.NUXT_HUB_DB_DIALECT === 'postgresql' ? 'postgresql' : 'sqlite',
		blob: true,
	},

	// Disabled: the first-run consent prompt needs a real TTY and crashes non-interactive
	// callers (CI, git hooks) with ERR_TTY_INIT_FAILED on Windows. See docs/git-workflow.md.
	telemetry: false,

	css: ['~/assets/css/main.css'],

	// Light is the brand default (docs/design-system.md); the sun/moon toggle switches to dark "terminal".
	colorMode: {
		preference: 'light',
		fallback: 'light',
	},

	// Open stand-ins for Enjoei's licensed/proprietary faces, self-hosted by @nuxt/fonts at build time.
	fonts: {
		families: [
			{ name: 'Figtree', weights: [400, 500, 600, 700, 800] },
			{ name: 'Big Shoulders Display', weights: [800, 900] },
			{ name: 'JetBrains Mono', weights: [500, 700] },
		],
	},

	// Every key can be overridden at runtime with a NUXT_* env var (see docs/environment-variables.md)
	runtimeConfig: {
		// Missing production secrets abort startup. Tests/CI set NUXT_STRICT_ENV=false.
		strictEnv: true,
		platformFeeBps: 1000,
		contactEmail: '',
		stripe: {
			secretKey: '',
			webhookSecret: '',
			// Test-only: points the Stripe SDK at tests/integration/helpers/fake-stripe.ts. Empty = api.stripe.com.
			apiBase: '',
		},
		resend: {
			apiKey: '',
		},
		email: {
			from: '',
		},
		// NUXT_SESSION_PASSWORD, >= 32 chars (nuxt-auth-utils seals the session cookie with it).
		session: {
			password: '',
		},
		public: {
			siteUrl: 'http://localhost:3000',
			stripe: {
				publishableKey: '',
			},
		},
	},

	routeRules: {
		// Stricter than the global limiter (D20): brute-force/enumeration protection on auth endpoints.
		// 30/5min per IP across signup+login+forgot/reset-password+me: tight enough to slow brute
		// force, loose enough for a real user's retries (mistyped password, forgot email, etc.).
		// Overridable via NUXT_AUTH_RATE_LIMIT_TOKENS: tests/integration/global-setup.ts raises it,
		// since every integration test file now shares one server/IP (one build, not one per file —
		// see the NITRO_PRESET note below) and together they legitimately sign up 30+ users.
		'/api/auth/**': {
			security: {
				rateLimiter: {
					tokensPerInterval: Number(process.env.NUXT_AUTH_RATE_LIMIT_TOKENS) || 30,
					interval: 300_000,
				},
			},
		},
		// Tighter than auth: the contact form has no account behind it to slow down repeat abuse.
		'/api/contact': { security: { rateLimiter: { tokensPerInterval: 5, interval: 900_000 } } },
		// A06: each call creates an order and a Stripe session; 20/15min covers real retries.
		'/api/checkout': {
			security: { rateLimiter: { tokensPerInterval: 20, interval: 900_000 } },
		},
	},

	compatibilityDate: '2026-06-30',

	// D14/Phase 10: collect every handler's defineRouteMeta() so server/api/v1/openapi.json.get.ts can
	// build the public seller API spec. Nitro's own /_openapi.json, /_scalar and /_swagger routes stay
	// off in production (they'd list every internal route, admin included).
	nitro: {
		experimental: { openAPI: true },
		openAPI: {
			production: false,
			meta: { title: 'resell.sh seller API', version: '1.0.0' },
			ui: { scalar: false, swagger: false },
		},
	},

	// No hardcoded nitro.preset here: Nitro reads the standard NITRO_PRESET env var itself.
	// `bun run build` sets NITRO_PRESET=bun for the deploy runtime (`bun .output/server/index.mjs`,
	// infra/docker/Dockerfile); `test:smoke`/`test:e2e` inherit it because Playwright's `webServer`
	// runs `bun run build && bun run start` (playwright.config.ts), and `test:integration` inherits
	// it the same way because `tests/integration/global-setup.ts` also runs `bun run build` by hand
	// (once for the whole suite) instead of going through `@nuxt/test-utils/e2e`'s own `setup()`.
	// Getting this preset right matters: without NITRO_PRESET=bun, the build-time dependency tracer
	// resolves package.json `exports` conditions as if targeting plain Node and only copies the
	// Node-conditional file into `.output/server/node_modules` for a package that ships a separate
	// "bun" condition (stripe, @libsql/isomorphic-ws), but the server ends up running under Bun
	// regardless (`bun .output/server/index.mjs`, or `@nuxt/test-utils`' `bun --bun` `node` shim —
	// docs/testing.md), whose native resolver picks the "bun" condition at runtime instead, pointing
	// at a file that was never copied (`Cannot find package 'stripe'`, discovered in Phase 6 when a
	// real "bun" conditional export first diverged from the Node one). `nuxt dev` keeps the
	// node-server default since it isn't a preset-sensitive prebuilt bundle.

	// OWASP A02/A05: secure headers, CSP with nonces, request size limits, rate limiting
	security: {
		rateLimiter: {
			// NUXT_RATE_LIMIT_TOKENS (build time): the integration suite shares one server/IP for
			// every file, so it raises this like NUXT_AUTH_RATE_LIMIT_TOKENS.
			tokensPerInterval: Number(process.env.NUXT_RATE_LIMIT_TOKENS) || 1000,
			interval: 300_000,
		},
		headers: {
			contentSecurityPolicy: {
				// picsum.photos: placeholder photos of the fake seed catalog (server/db/seed.ts, dev only).
				'img-src': [
					"'self'",
					'data:',
					'https://picsum.photos',
					'https://fastly.picsum.photos',
				],
			},
		},
	},
})
