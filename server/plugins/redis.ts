import type { Driver } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import redisDriver from 'unstorage/drivers/redis'

// Mounted at run time, not in nuxt.config: REDIS_URL then comes from the environment the server starts in
// instead of being baked into the build. `cache` backs defineCachedEventHandler; `#rate-limiter-storage`
// is nuxt-security's limiter, so every replica counts against the same per-IP buckets.
export default defineNitroPlugin(async () => {
	const url = redisUrl()
	if (!url) return
	const storage = useStorage()
	for (const [mount, base] of [
		['cache', 'cache'],
		['#rate-limiter-storage', 'ratelimit'],
	] as const) {
		await storage.unmount(mount, false)
		storage.mount(
			mount,
			// preConnect: connect now, not on the first request (which would fail while still connecting).
			failOpen(
				redisDriver({ url, base: `resell:${base}`, preConnect: true, ...redisOptions }),
				memoryDriver(),
			),
		)
	}
	console.info('[redis] cache and rate limits use Redis')
})

// nuxt-security's limiter doesn't catch storage errors, so a Redis outage would turn every request into a
// 500. Each failed call falls back to this process's memory instead (per-replica limits until Redis is back).
function failOpen(primary: Driver, fallback: Driver): Driver {
	const call =
		(method: 'hasItem' | 'getItem' | 'setItem' | 'removeItem' | 'getKeys' | 'clear') =>
		async (...args: unknown[]) => {
			try {
				return await (primary[method] as (...a: unknown[]) => unknown)(...args)
			} catch (error) {
				console.warn(`[redis] ${method} failed, using memory:`, (error as Error).message)
				return (fallback[method] as ((...a: unknown[]) => unknown) | undefined)?.(...args)
			}
		}
	return {
		name: 'redis-fail-open',
		hasItem: call('hasItem'),
		getItem: call('getItem'),
		setItem: call('setItem'),
		removeItem: call('removeItem'),
		getKeys: call('getKeys'),
		clear: call('clear'),
		dispose: () => primary.dispose?.(),
	} as Driver
}
