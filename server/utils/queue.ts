import { Queue } from 'bullmq'
import type { SendMailOptions } from './mail'

// Emails leave the request path through a BullMQ queue on Redis: a Resend outage no longer slows or fails a
// webhook/checkout, and failed sends retry with exponential backoff (5 attempts) before landing in the
// failed set. Without Redis the mail is sent inline, as before (dev, tests).
export const MAIL_QUEUE = 'mail'
let mailQueue: Queue<SendMailOptions> | undefined

export async function queueMail(options: SendMailOptions): Promise<void> {
	const connection = useRedis()
	if (!connection) return sendMail(options)
	mailQueue ??= new Queue<SendMailOptions>(MAIL_QUEUE, { connection })
	try {
		await mailQueue.add('send', options, {
			attempts: 5,
			backoff: { type: 'exponential', delay: 5_000 },
			removeOnComplete: 1_000,
			removeOnFail: 5_000,
		})
	} catch (error) {
		// Redis down: send now rather than lose the mail.
		console.warn('[queue] enqueue failed, sending inline:', (error as Error).message)
		await sendMail(options)
	}
}
