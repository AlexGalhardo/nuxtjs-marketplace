import { appendFile } from 'node:fs/promises'
import { Resend } from 'resend'

export interface SendMailOptions {
	to: string
	subject: string
	text: string
}

// D7: without NUXT_RESEND_API_KEY, emails are logged instead of sent (dev/test).
export async function sendMail(options: SendMailOptions): Promise<void> {
	const config = useRuntimeConfig()

	if (!config.resend.apiKey) {
		console.info(`[mail] To: ${options.to}\nSubject: ${options.subject}\n\n${options.text}`)
		// Test-only outbox (tests/qa): one JSON line per mail, so the QA suite can assert recipients.
		// Unreachable in production, where NUXT_RESEND_API_KEY is required.
		if (process.env.MAIL_OUTBOX_FILE) {
			await appendFile(process.env.MAIL_OUTBOX_FILE, `${JSON.stringify(options)}\n`)
		}
		return
	}

	const resend = new Resend(config.resend.apiKey)
	const { error } = await resend.emails.send({
		from: config.email.from || 'onboarding@resend.dev',
		to: options.to,
		subject: options.subject,
		text: options.text,
	})

	if (error) {
		throw createError({ statusCode: 502, statusMessage: 'Failed to send email' })
	}
}
