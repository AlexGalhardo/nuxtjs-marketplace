// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-security', '@nuxthub/core'],

  devtools: {
    enabled: true,
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

  // Every key can be overridden at runtime with a NUXT_* env var (see docs/environment-variables.md)
  runtimeConfig: {
    // Missing production secrets abort startup. Tests/CI set NUXT_STRICT_ENV=false.
    strictEnv: true,
    platformFeeBps: 1000,
    contactEmail: '',
    stripe: {
      secretKey: '',
      webhookSecret: '',
    },
    resend: {
      apiKey: '',
    },
    email: {
      from: '',
    },
    public: {
      siteUrl: 'http://localhost:3000',
      stripe: {
        publishableKey: '',
      },
    },
  },

  routeRules: {
    '/': { prerender: true },
  },

  compatibilityDate: '2026-06-30',

  // Bun.randomUUIDv7() (shared/utils/id.ts) needs Bun's global type declarations.
  typescript: {
    tsConfig: {
      compilerOptions: {
        types: ['bun'],
      },
    },
  },

  // OWASP A02/A05: secure headers, CSP with nonces, request size limits, rate limiting
  security: {
    rateLimiter: {
      tokensPerInterval: 1000,
      interval: 300_000,
    },
  },
})
