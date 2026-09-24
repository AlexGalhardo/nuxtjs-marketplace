// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-security', '@nuxthub/core', 'nuxt-auth-utils'],

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
    '/': { prerender: true },
    // Stricter than the global limiter (D20): brute-force/enumeration protection on auth endpoints.
    // 30/5min per IP across signup+login+forgot/reset-password+me: tight enough to slow brute
    // force, loose enough for a real user's retries (mistyped password, forgot email, etc.).
    '/api/auth/**': { security: { rateLimiter: { tokensPerInterval: 30, interval: 300_000 } } },
  },

  compatibilityDate: '2026-06-30',

  // No hardcoded nitro.preset here: Nitro reads the standard NITRO_PRESET env var itself.
  // `bun run build` sets NITRO_PRESET=bun for the real deploy runtime (`bun .output/server/index.mjs`,
  // infra/docker/Dockerfile) — without it, the build-time dependency tracer resolves package.json
  // `exports` conditions as if targeting Node, which can copy the wrong conditional file for a
  // package that ships a separate "bun" condition (e.g. @libsql/isomorphic-ws) — present at build
  // time, missing at runtime. `@nuxt/test-utils` always spawns the built server via plain `node`
  // (not configurable), so test/dev builds correctly default to the node-server preset instead.

  // OWASP A02/A05: secure headers, CSP with nonces, request size limits, rate limiting
  security: {
    rateLimiter: {
      tokensPerInterval: 1000,
      interval: 300_000,
    },
  },
})
