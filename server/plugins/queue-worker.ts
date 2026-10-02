import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import type { SendMailOptions } from '../utils/mail'

// Every app replica also runs a mail worker (BullMQ hands each job to exactly one of them). Set
// QUEUE_WORKER=false on a replica to make it web-only, e.g. when workers move to their own service.
export default defineNitroPlugin((nitroApp) => {
	const url = redisUrl()
	if (!url || process.env.QUEUE_WORKER === 'false') return
	// Its own connection: workers block on Redis and BullMQ requires maxRetriesPerRequest: null here; it
	// reconnects by itself after an outage.
	const connection = new Redis(url, { maxRetriesPerRequest: null, family: 0 })
	const worker = new Worker<SendMailOptions>(MAIL_QUEUE, (job) => sendMail(job.data), {
		connection,
		concurrency: 5,
	})
	worker.on('failed', (job, error) =>
		console.error(
			`[queue] mail job ${job?.id} failed (attempt ${job?.attemptsMade})`,
			error.message,
		),
	)
	nitroApp.hooks.hook('close', () => worker.close())
	console.info('[queue] mail worker started')
})
