# Environment variables (planned — Phase 1.3)

Copy `.env.example` to `.env`. Nuxt maps `NUXT_*` variables onto `runtimeConfig` automatically.

| Variable | Required | Description |
|----------|----------|-------------|
| `NUXT_PUBLIC_SITE_URL` | yes | Public base URL (e.g. `http://localhost:3000`) |
| `NUXT_SESSION_PASSWORD` | yes | ≥ 32 chars, seals the session cookie (nuxt-auth-utils) |
| `NUXT_HUB_DB_DIALECT` | build | `sqlite` (default) or `postgresql` |
| `DATABASE_URL` | postgres | PostgreSQL connection string |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` | prod/docker | Blob storage (MinIO locally) |
| `NUXT_STRIPE_SECRET_KEY` | yes | Stripe secret key (test mode in dev) |
| `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes | Stripe publishable key |
| `NUXT_STRIPE_WEBHOOK_SECRET` | yes | Webhook signing secret (`whsec_...`) |
| `NUXT_PLATFORM_FEE_BPS` | no | Platform fee in basis points (default `1000` = 10%) |
| `NUXT_RESEND_API_KEY` | no | Without it, emails are logged instead of sent |
| `NUXT_EMAIL_FROM` | no | Sender address |
| `NUXT_CONTACT_EMAIL` | no | Destination for `/contact` messages |
