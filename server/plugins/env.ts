// Fail fast on invalid configuration (OWASP A02: security misconfiguration)
export default defineNitroPlugin(() => {
  // Prerendering runs at build time, where production secrets are intentionally absent
  if (import.meta.prerender) return

  const config = useRuntimeConfig()
  // NODE_ENV is inlined at build time, so strictness is a runtime flag instead
  const strict = !import.meta.dev && config.strictEnv
  const { errors, warnings } = validateRuntimeEnv(config, strict)

  for (const warning of warnings) {
    console.warn(`[env] ${warning}`)
  }

  if (errors.length > 0) {
    throw new Error(`[env] Invalid runtime configuration:\n- ${errors.join('\n- ')}`)
  }
})
