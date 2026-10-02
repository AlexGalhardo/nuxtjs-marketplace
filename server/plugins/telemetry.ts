import { context, metrics, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import type { H3Event } from 'h3'

// OpenTelemetry (docs/observability.md). Off unless configured through the standard OTEL_* env vars:
// OTEL_EXPORTER_OTLP_ENDPOINT turns on traces (Tempo, Railway tracing, any OTLP backend) and
// OTEL_METRICS_EXPORTER=prometheus serves metrics on :9464/metrics for Prometheus to scrape. Spans are
// created by hand from Nitro's hooks: auto-instrumentation patches Node's require, which Bun and a
// bundled Nitro server don't go through.
export default defineNitroPlugin((nitroApp) => {
	if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT && !process.env.OTEL_METRICS_EXPORTER) return

	process.env.OTEL_SERVICE_NAME ||= 'resell-sh'
	process.env.OTEL_TRACES_EXPORTER ||= process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? 'otlp' : 'none'
	process.env.OTEL_METRICS_EXPORTER ||= 'none'
	process.env.OTEL_LOGS_EXPORTER ||= 'none'
	const sdk = new NodeSDK({ instrumentations: [] })
	sdk.start()
	nitroApp.hooks.hook('close', () => sdk.shutdown())

	const tracer = trace.getTracer('resell-sh')
	const meter = metrics.getMeter('resell-sh')
	const duration = meter.createHistogram('http.server.request.duration', {
		unit: 's',
		description: 'Duration of HTTP requests',
	})
	const started = new WeakMap<H3Event, number>()

	nitroApp.hooks.hook('request', (event) => {
		started.set(event, performance.now())
		// Continue a trace started upstream (traceparent header), e.g. by Railway's edge.
		const parent = propagation.extract(context.active(), event.node.req.headers)
		event.context.otelSpan = tracer.startSpan(
			`${event.method} ${event.path.split('?')[0]}`,
			{
				kind: SpanKind.SERVER,
				attributes: {
					'http.request.method': event.method,
					'url.path': event.path.split('?')[0],
				},
			},
			parent,
		)
	})

	nitroApp.hooks.hook('afterResponse', (event) => {
		const span = event.context.otelSpan as ReturnType<typeof tracer.startSpan> | undefined
		const status = event.node.res.statusCode
		// The matched route pattern (/api/products/:slug), not the raw path: bounded metric cardinality.
		const route = (event.context.matchedRoute?.path as string | undefined) ?? 'unmatched'
		span?.setAttributes({ 'http.response.status_code': status, 'http.route': route })
		span?.updateName(`${event.method} ${route}`)
		if (status >= 500) span?.setStatus({ code: SpanStatusCode.ERROR })
		span?.end()
		const start = started.get(event)
		if (start !== undefined) {
			duration.record((performance.now() - start) / 1000, {
				'http.request.method': event.method,
				'http.route': route,
				'http.response.status_code': status,
			})
		}
	})

	nitroApp.hooks.hook('error', (error, { event }) => {
		const span = event?.context.otelSpan as ReturnType<typeof tracer.startSpan> | undefined
		span?.recordException(error)
		span?.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
	})

	console.info('[otel] telemetry on')
})
