import { eq } from 'drizzle-orm'

// A password change (reset or profile update) must invalidate every other active session
// (docs/authentication.md). Sessions are stateless sealed cookies, so we compare a hash of the
// password at login time against the user's current password_hash.
//
// This `fetch` hook only runs for nuxt-auth-utils' own client-facing GET /api/_auth/session route
// (i.e. the client calling useUserSession().fetch(), including automatic hydration on page load)
// — it is NOT invoked by requireUserSession()/getUserSession() inside our own server/api handlers
// (verified in nuxt-auth-utils@0.5.30's source). server/utils/auth.ts's requireUser() carries the
// equivalent check for that path; this plugin covers client rehydration on another device/browser.
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session) => {
    if (!session.user) return

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.user.id))
    if (!user || hashToken(user.passwordHash) !== session.passwordVersion) {
      throw createError({ statusCode: 401, statusMessage: 'Session expired, please log in again' })
    }
  })
})
