# Environment variables

Copy `.env.example` to `.env`. Nuxt maps `NUXT_*` variables onto `runtimeConfig` at runtime
(declared in `nuxt.config.ts`, validated by `server/utils/env.ts` at startup).
Variables marked *(Phase N)* are not wired yet; add them to `runtimeConfig`, the Zod schema and `.env.example` together.

| Variable | Required | Description |
|----------|----------|-------------|
| `NUXT_STRICT_ENV` | no | Default `true`: missing production secrets abort startup. Set `false` only for tests/CI |
| `NUXT_PUBLIC_SITE_URL` | yes | Public base URL (e.g. `http://localhost:3000`) |
| `NUXT_SESSION_PASSWORD` | yes | ≥ 32 chars, seals the session cookie (nuxt-auth-utils). Auto-generated in `nuxt dev` if left empty |
| `NUXT_HUB_DB_DIALECT` | build | `sqlite` (default) or `postgresql`. Read directly in `nuxt.config.ts` (`hub.db`), not part of `runtimeConfig` |
| `DATABASE_URL` | postgres | PostgreSQL connection string, read by `@nuxthub/core`'s postgres-js driver |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` | prod/docker | Blob storage (MinIO locally); leave empty to use the local `fs` driver (`.data/blob`) |
| `E2E_PORT` | no | Port for the Playwright test server (default `3100`) |
| `PLAYWRIGHT_SKIP_BUILD` | no | `1` = Playwright reuses the existing `.output` build |
| `NUXT_STRIPE_SECRET_KEY` | yes | Stripe secret key (test mode in dev) |
| `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes | Stripe publishable key |
| `NUXT_STRIPE_WEBHOOK_SECRET` | yes | Webhook signing secret (`whsec_...`) |
| `NUXT_PLATFORM_FEE_BPS` | no | Platform fee in basis points (default `1000` = 10%) |
| `NUXT_RESEND_API_KEY` | no | Without it, emails are logged instead of sent |
| `NUXT_EMAIL_FROM` | no | Sender address |
| `NUXT_CONTACT_EMAIL` | no | Destination for `/contact` messages |

> Nitro's runtime env merge auto-parses a purely numeric env var value into a JS number (via unjs
> `destr`) before it reaches `runtimeEnvSchema`. Every string-typed key in `server/utils/env.ts`
> therefore uses `z.coerce.string()`, not `z.string()`, so a numeric-looking secret doesn't fail
> validation with "expected string, received number".
