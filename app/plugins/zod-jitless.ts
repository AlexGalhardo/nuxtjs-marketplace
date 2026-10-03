import { z } from 'zod'

// Zod 4 probes `Function('')` when an object schema is built, to decide whether to JIT-compile its
// parser. Our CSP has no 'unsafe-eval', so that probe was a blocked eval: a CSP violation on every page
// with a form (caught by the QA crawl). Jitless mode skips the probe. Set at module load, not inside
// the plugin: the router resolves the first page (and builds its schemas) before plugins run.
z.config({ jitless: true })

export default defineNuxtPlugin(() => {})
