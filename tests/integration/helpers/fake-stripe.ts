import { createServer, type Server } from 'node:http'

// Just enough of the Stripe REST API for the checkout → webhook → transfer flow, so integration
// tests run without network or real keys (the server gets NUXT_STRIPE_API_BASE pointing here).
// Test files read what the app sent via GET /__requests. Destination `acct_fail` fails transfers.
// A refund for a payment intent containing `refund_fail` fails.
export const FAKE_STRIPE_PORT = 12_111

export interface RecordedRequest {
	method: string
	path: string
	body: Record<string, string>
	idempotencyKey: string | null
}

export function startFakeStripe(): Server {
	const requests: RecordedRequest[] = []
	let sequence = 0

	const server = createServer((req, res) => {
		let raw = ''
		req.on('data', (chunk) => {
			raw += chunk
		})
		req.on('end', () => {
			const path = (req.url ?? '').split('?')[0] ?? ''
			const send = (status: number, payload: unknown) => {
				res.writeHead(status, { 'content-type': 'application/json' })
				res.end(JSON.stringify(payload))
			}
			if (path === '/__requests') return send(200, requests)

			const body = Object.fromEntries(new URLSearchParams(raw))
			const idempotencyKey = (req.headers['idempotency-key'] as string | undefined) ?? null
			requests.push({ method: req.method ?? '', path, body, idempotencyKey })
			sequence += 1

			if (req.method === 'POST' && path === '/v1/checkout/sessions') {
				const id = `cs_test_fake_${sequence}`
				return send(200, {
					id,
					object: 'checkout.session',
					url: `https://checkout.stripe.test/${id}`,
				})
			}
			const intent = path.match(/^\/v1\/payment_intents\/([^/]+)$/)
			if (req.method === 'GET' && intent) {
				return send(200, {
					id: intent[1],
					object: 'payment_intent',
					latest_charge: `ch_for_${intent[1]}`,
				})
			}
			if (req.method === 'POST' && path === '/v1/transfers') {
				if (body.destination === 'acct_fail') {
					return send(400, {
						error: { type: 'invalid_request_error', message: 'No such destination' },
					})
				}
				return send(200, {
					id: `tr_test_fake_${sequence}`,
					object: 'transfer',
					amount: Number(body.amount),
				})
			}
			if (req.method === 'POST' && path === '/v1/refunds') {
				if (body.payment_intent?.includes('refund_fail')) {
					return send(400, {
						error: {
							type: 'invalid_request_error',
							message: 'Charge already refunded',
						},
					})
				}
				return send(200, {
					id: `re_test_fake_${sequence}`,
					object: 'refund',
					amount: Number(body.amount),
					status: 'succeeded',
				})
			}
			const reversal = path.match(/^\/v1\/transfers\/([^/]+)\/reversals$/)
			if (req.method === 'POST' && reversal) {
				return send(200, {
					id: `trr_test_fake_${sequence}`,
					object: 'transfer_reversal',
					transfer: reversal[1],
					amount: Number(body.amount),
				})
			}
			send(404, {
				error: {
					type: 'invalid_request_error',
					message: `fake-stripe: ${req.method} ${path}`,
				},
			})
		})
	})
	server.listen(FAKE_STRIPE_PORT, '127.0.0.1')
	return server
}
