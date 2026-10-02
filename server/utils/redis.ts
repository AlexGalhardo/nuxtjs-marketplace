import { Redis, type RedisOptions } from 'ioredis'

// Redis is optional (docs/system-design/07-caching.md): with REDIS_URL set, replicas share the response
// cache, rate limits and the mail queue; without it (dev, tests) everything stays in-process. When Redis
// goes down the app degrades to that same in-process behavior instead of failing requests.
let client: Redis | null | undefined

// Fail fast while disconnected (no offline queue, one retry), so a Redis outage costs a request
// milliseconds, not the ~20 silent retries ioredis does by default. `family: 0` resolves IPv6 too
// (Railway's private network).
export const redisOptions: RedisOptions = {
	enableOfflineQueue: false,
	maxRetriesPerRequest: 1,
	family: 0,
}

export function redisUrl(): string | undefined {
	return process.env.REDIS_URL || undefined
}

export function useRedis(): Redis | null {
	if (client === undefined) {
		const url = redisUrl()
		client = url ? new Redis(url, redisOptions) : null
		client?.on('error', (error) => console.warn('[redis]', error.message))
	}
	return client
}

// Public catalog reads (no per-user data) are cached in Redis for 30 s and served stale while they refresh.
// Without Redis the cache is bypassed: a per-process memory cache would show replicas different catalogs.
export const catalogCache = {
	maxAge: 30,
	swr: true,
	shouldBypassCache: (): boolean => !redisUrl(),
}
