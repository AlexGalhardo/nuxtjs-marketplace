import type { UserRole } from './enums'

declare module '#auth-utils' {
	interface User {
		id: string
		name: string
		email: string
		role: UserRole
	}

	interface UserSession {
		user: User
		// Hash of the user's current password_hash at login time. server/plugins/auth-session.ts
		// compares it on every request so a password change invalidates sessions signed before it.
		passwordVersion: string
		loggedInAt: number
	}
}
