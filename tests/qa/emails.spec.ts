import {
	CONTACT_EMAIL,
	checkout,
	expect,
	listProduct,
	makeBuyer,
	makeSeller,
	newApi,
	ok,
	outbox,
	pay,
	sellerOrderOf,
	signUp,
	test,
	unique,
} from './helpers'

// Outgoing mail, read from the test outbox (MAIL_OUTBOX_FILE, server/utils/mail.ts): the right people
// get the right message, and nobody else does. Mails are sent after the response, so wait for them.

const mailTo = (to: string, subject: RegExp) =>
	expect.poll(() => outbox(to).filter((mail) => subject.test(mail.subject)).length, {
		timeout: 10_000,
	})

test('password reset goes to the account owner only, with a one-time link', async ({
	playwright,
}) => {
	const api = await newApi(playwright)
	const { email } = await signUp(api, 'reset')
	await ok(await api.post('/api/auth/forgot-password', { data: { email } }))
	await mailTo(email, /^Reset your password$/).toBe(1)
	expect(outbox(email)[0]?.text).toMatch(/\/reset-password\?token=[0-9a-f]{64}/)

	// Unknown addresses get the same answer and no mail (no user enumeration).
	const nobody = `nobody-${unique()}@qa.resell.test`
	await ok(await api.post('/api/auth/forgot-password', { data: { email: nobody } }))
	await expect.poll(() => outbox(nobody).length, { timeout: 2_000 }).toBe(0)
})

test('a paid order mails the buyer and every seller; ship and refund mail the buyer', async ({
	playwright,
}) => {
	const alice = await makeSeller(playwright)
	const bob = await makeSeller(playwright)
	const jacket = await listProduct(alice, 'physical')
	const lamp = await listProduct(bob, 'physical')
	const buyer = await makeBuyer(playwright)
	const orderId = await checkout(buyer, [[jacket.id], [lamp.id]])
	expect(outbox(buyer.email)).toEqual([])
	await pay(buyer.api, orderId)

	await mailTo(buyer.email, /^your resell\.sh order is paid$/).toBe(1)
	expect(outbox(buyer.email)[0]?.text).toContain(`/orders/${orderId}`)
	await mailTo(alice.email, /^you made a sale on /).toBe(1)
	await mailTo(bob.email, /^you made a sale on /).toBe(1)
	expect(outbox(alice.email)[0]?.text).not.toContain(bob.email)

	await ok(
		await alice.api.post(`/api/v1/shop/orders/${sellerOrderOf(orderId, alice.shopId)}/ship`, {
			data: { carrier: 'usps', trackingCode: 'QA-TRACK-1' },
		}),
	)
	await mailTo(buyer.email, /^your resell\.sh order shipped$/).toBe(1)
	expect(outbox(buyer.email).find((mail) => /shipped/.test(mail.subject))?.text).toContain(
		'QA-TRACK-1',
	)

	await ok(await bob.api.post(`/api/v1/shop/orders/${sellerOrderOf(orderId, bob.shopId)}/refund`))
	await mailTo(buyer.email, /^you got a refund on resell\.sh$/).toBe(1)
	// Sellers never get the buyer's mails.
	expect(outbox(alice.email).map((mail) => mail.subject)).toEqual([
		expect.stringMatching(/^you made a sale/),
	])
})

test('the contact form mails the team, with the visitor in the body', async ({ playwright }) => {
	const api = await newApi(playwright)
	const subject = `qa contact ${unique()}`
	await ok(
		await api.post('/api/contact', {
			data: {
				name: 'qa visitor',
				email: 'visitor@qa.resell.test',
				subject,
				message: 'hello from the qa suite, please ignore.',
			},
		}),
	)
	await expect
		.poll(
			() =>
				outbox(CONTACT_EMAIL).filter((mail) => mail.subject === `[Contact] ${subject}`)
					.length,
			{ timeout: 10_000 },
		)
		.toBe(1)
	expect(
		outbox(CONTACT_EMAIL).find((mail) => mail.subject === `[Contact] ${subject}`)?.text,
	).toContain('visitor@qa.resell.test')
	expect(outbox('visitor@qa.resell.test')).toEqual([])
})
