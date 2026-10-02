# check=skip=SecretsUsedInArgOrEnv
# (Deliberate: S3 build args, see the comment above them. Never publish an image built with them.)
# Multi-stage build for the Nuxt Marketplace server. Build context is the repo root:
#   docker build -f infra/docker/Dockerfile -t nuxtjs-marketplace .
#   docker build -f infra/docker/Dockerfile --target migrate -t nuxtjs-marketplace:migrate .

# Final stage. Railway builds the whole file, so its app service sets APP_TARGET=migrate to get an
# image that can also run the pre-deploy migrations (docs/infra-and-setup.md "Railway").
ARG APP_TARGET=runtime

FROM oven/bun:1.4.2 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
# Bun applies patches/ (patchedDependencies) during install.
COPY patches ./patches
RUN bun install --frozen-lockfile

FROM base AS build
# The dialect is fixed at build time (docs/database.md); production images run on PostgreSQL.
ARG NUXT_HUB_DB_DIALECT=postgresql
ENV NUXT_HUB_DB_DIALECT=$NUXT_HUB_DB_DIALECT
# Optional S3 blob storage. NuxtHub bakes these into the server bundle, so only pass them to a private,
# per-environment build (Railway); the public GHCR image is built without them and uses `fs`.
ARG S3_ACCESS_KEY_ID
ARG S3_SECRET_ACCESS_KEY
ARG S3_BUCKET
ARG S3_REGION
ARG S3_ENDPOINT
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# One-shot job: apply pending migrations and seed the product types. NuxtHub only migrates during
# `nuxt build`/dev and the runtime image has no Nuxt CLI, so this reuses the build stage.
# DATABASE_URL is read at run time.
FROM build AS migrate
ENV NODE_ENV=production
CMD ["sh", "-c", "bun run db:migrate && bun run db:seed"]

FROM base AS runtime
ENV NODE_ENV=production
# `bun` (uid 1000) ships with the oven/bun image. Uploads use NuxtHub's `fs` blob driver under
# /app/.data (mount a volume there): NuxtHub fixes the blob driver and its S3 credentials at build
# time, so a published image can't switch to S3 from run-time env (docs/infra-and-setup.md).
COPY --from=build --chown=bun:bun /app/.output ./.output
RUN mkdir -p .data && chown bun:bun .data
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", ".output/server/index.mjs"]

FROM ${APP_TARGET} AS final
