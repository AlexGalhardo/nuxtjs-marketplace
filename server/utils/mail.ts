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
