import type { H3Event } from 'h3'
import type { User } from '../../shared/types/db'

// Embeds a hash of the current password_hash in the session so
// server/plugins/auth-session.ts can invalidate sessions signed before a password change.
export async function createUserSession(event: H3Event, user: User) {
  await setUserSession(event, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    passwordVersion: hashToken(user.passwordHash),
    loggedInAt: Date.now(),
  })
}

export function toSafeUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}
