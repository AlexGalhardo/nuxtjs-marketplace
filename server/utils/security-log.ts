import { getRequestHeader, getRequestIP, type H3Event } from 'h3'

// A09: authentication and abuse events, one JSON line each on stdout (container logs → your log
// shipper/alerting). Ids, reasons and the client IP only: never emails, passwords, tokens or cookies.
// Admin actions go to the `audit_logs` table instead (server/utils/audit.ts).
export type SecurityEventType =
	| 'login.succeeded'
	| 'login.failed'
	| 'password_reset.requested'
	| 'password_reset.completed'
	| 'password.changed'
	| 'csrf.refused'

export function logSecurityEvent(
	event: H3Event,
	type: SecurityEventType,
	details: Record<string, string | null> = {},
): void {
	// Same source as the rate limiter (nuxt.config.ts `ipHeader`): X-Real-IP from the reverse proxy.
	const ip = getRequestHeader(event, 'x-real-ip') ?? getRequestIP(event) ?? null
	console.info(JSON.stringify({ at: new Date().toISOString(), security: type, ip, ...details }))
}
