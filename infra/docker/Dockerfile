# Multi-stage build for the Nuxt Marketplace server. Build context is the repo root:
#   docker build -f infra/docker/Dockerfile -t nuxtjs-marketplace .

FROM oven/bun:1.4.2 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nuxt \
  && adduser --system --uid 1001 --ingroup nuxt nuxt
COPY --from=build --chown=nuxt:nuxt /app/.output ./.output
USER nuxt
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", ".output/server/index.mjs"]
