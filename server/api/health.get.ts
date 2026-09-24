// Liveness probe for Docker, CI and smoke tests. Intentionally exposes no version or config details.
export default defineEventHandler(() => ({ status: 'ok' }))
