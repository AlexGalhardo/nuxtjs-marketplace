# Observability

Three signals, all from widely used open-source tools, all optional: the app runs the same with none of them.

| Signal | In the app | Collected by | Viewed in |
|--------|-----------|--------------|-----------|
| Traces | `server/plugins/telemetry.ts`: one server span per request (continues an upstream `traceparent`), named by route pattern, status code, recorded exceptions | OTLP/HTTP → **Tempo** (self-hosted) or **Railway tracing** (production) | Grafana → Explore → Tempo; Railway → Traces |
| Metrics | `http.server.request.duration` histogram (method, route, status); `resell.money_events` / `resell.money_cents` counters from every `logTransaction()` row | **Prometheus** scrapes each replica's `:9464/metrics` (DNS service discovery) | Grafana dashboard "resell.sh — app" |
| Logs | stdout: Nitro logs, `[redis]`/`[queue]`/`[otel]` lines, security events as JSON lines (`server/utils/security-log.ts`) | **Grafana Alloy** tails the containers → **Loki** | Grafana → Explore → Loki, `{service="app"}` |

## Turning it on

The plugin starts the OpenTelemetry Node SDK only when standard `OTEL_*` variables are set:

- `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g. `http://tempo:4318`) → traces over OTLP/HTTP.
- `OTEL_METRICS_EXPORTER=prometheus` (+ `OTEL_EXPORTER_PROMETHEUS_HOST=0.0.0.0`) → metrics on port 9464.
- `OTEL_SERVICE_NAME` defaults to `resell-sh`.

Spans are created from Nitro's `request`/`afterResponse`/`error` hooks instead of auto-instrumentation, because
auto-instrumentation patches Node's `require`, which neither Bun nor a bundled Nitro server goes through. Metric
labels use the matched route pattern (`/api/products/:slug`), never the raw path, to keep cardinality bounded.

## Local stack

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.observability.yml up -d --build
```

- App (through Caddy): <http://localhost:3000> · Grafana: <http://localhost:3001> (anonymous admin, local only).
- Configs: `infra/observability/` (`tempo.yaml`, `prometheus.yml`, `config.alloy`, Grafana provisioning and the
  dashboard JSON).

## Production (Railway)

Tracing is enabled on the `app` service, so Railway injects the `OTEL_*` variables and its edge starts the trace;
the app's spans continue it. Read traces in the Railway dashboard (Traces tab) or with the Railway MCP
(`list-traces`, `get-trace`). Logs and HTTP metrics are in the service's Logs and Metrics tabs.

## Reading a checkout trace

1. Buy something; note the `x-railway-trace-id` response header (Railway) or open Tempo's search for
   `POST /api/stripe/webhook`.
2. The webhook span carries the status code and any exception; the same moment shows up in the "money events per
   minute" panel (`payment.succeeded`, `transfer.created`) and in Loki next to the request.
3. A spike of `transfer.failed` in the money panel with no 5xx in the request panel means Stripe refused the
   transfer, not that the app failed: check `transaction_logs` (`/admin/transaction-logs`).

## Exercises

- Add child spans around Stripe calls in `server/utils/orders.ts` (hint: run the handler inside
  `context.with(trace.setSpan(...))` so children find their parent).
- Add a queue-depth gauge from BullMQ's `getJobCounts()` and an alert when failed mail jobs grow.
