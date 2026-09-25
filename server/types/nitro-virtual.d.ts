// Virtual module Nitro generates when `nitro.experimental.openAPI` is on (nitropack 2.x rollup
// plugin `handlersMeta`): one entry per server handler with its defineRouteMeta() payload.
declare module '#nitro-internal-virtual/server-handlers-meta' {
	export const handlersMeta: {
		route?: string
		method?: string
		meta?: { openAPI?: Record<string, unknown> }
	}[]
}
