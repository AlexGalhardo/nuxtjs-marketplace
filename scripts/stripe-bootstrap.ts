// `bun run stripe:bootstrap <site-url> [--railway]`: creates (or updates) the two webhook endpoints this app
// needs, idempotently. Uses STRIPE_SECRET_KEY (or NUXT_STRIPE_SECRET_KEY): a test key for the sandbox, a live
// key for production. Signing secrets are only returned when an endpoint is created; with --railway they go
// straight into the Railway `app` service as NUXT_STRIPE_WEBHOOK_SECRET instead of being printed.
import Stripe from 'stripe'

// Keep in sync with the switch in server/api/stripe/webhook.post.ts (docs/payments-stripe.md).
const endpoints = [
	{
		connect: false,
		events: [
			'checkout.session.completed',
			'checkout.session.async_payment_succeeded',
			'checkout.session.async_payment_failed',
			'checkout.session.expired',
			'charge.refunded',
			'charge.dispute.created',
			'charge.dispute.closed',
		],
	},
	// Connected (Express) accounts' events only reach a Connect endpoint.
	{ connect: true, events: ['account.updated'] },
] satisfies { connect: boolean; events: Stripe.WebhookEndpointCreateParams.EnabledEvent[] }[]

const [siteUrl] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const toRailway = process.argv.includes('--railway')
const key = process.env.STRIPE_SECRET_KEY || process.env.NUXT_STRIPE_SECRET_KEY
if (!siteUrl || !key) {
	console.error(
		'usage: STRIPE_SECRET_KEY=sk_... bun run stripe:bootstrap https://your.site [--railway]',
	)
	process.exit(1)
}

const stripe = new Stripe(key)
const url = `${siteUrl.replace(/\/$/, '')}/api/stripe/webhook`
const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter(
	(e) => e.url === url,
)
const secrets: string[] = []

for (const wanted of endpoints) {
	const kind = wanted.connect ? 'connect' : 'platform'
	// Matched by our own metadata tag: the API doesn't say whether an endpoint listens to Connect events.
	const found = existing.find((e) => e.metadata?.resell === kind)
	if (found) {
		await stripe.webhookEndpoints.update(found.id, {
			enabled_events: wanted.events,
			disabled: false,
		})
		console.log(`updated ${kind} endpoint ${found.id}`)
		continue
	}
	const created = await stripe.webhookEndpoints.create({
		url,
		enabled_events: wanted.events,
		connect: wanted.connect,
		description: `resell.sh ${kind} events`,
		metadata: { resell: kind },
	})
	if (created.secret) secrets.push(created.secret)
	console.log(`created ${kind} endpoint ${created.id}`)
}

if (!secrets.length) {
	console.log(
		'No new endpoint: the existing signing secrets stay valid (roll them in the Dashboard if lost).',
	)
} else if (secrets.length < endpoints.length) {
	console.log(
		'Only some endpoints were new: append the new secret to the existing NUXT_STRIPE_WEBHOOK_SECRET.',
	)
}
if (secrets.length === endpoints.length) {
	const value = secrets.join(',')
	if (toRailway) {
		const set = Bun.spawnSync([
			'railway',
			'variable',
			'set',
			'--service',
			'app',
			`NUXT_STRIPE_WEBHOOK_SECRET=${value}`,
		])
		console.log(
			set.success
				? 'NUXT_STRIPE_WEBHOOK_SECRET set on Railway (app redeploys).'
				: set.stderr.toString(),
		)
	} else {
		console.log(`NUXT_STRIPE_WEBHOOK_SECRET=${value}`)
	}
}
