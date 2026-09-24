# Authentication

- `nuxt-auth-utils`: sealed cookie session (`NUXT_SESSION_PASSWORD`, at least 32 chars).
  Server: `setUserSession`, `requireUserSession`, `clearUserSession`, `hashPassword`, `verifyPassword`.
  Client: `useUserSession()` (`loggedIn`, `user`, `fetch`, `clear`), wrapped by `app/composables/useAuth.ts`
  (`signup`/`login`/`logout` call our own `/api/auth/**` endpoints, then refresh the client session).
- Session payload: `{ user: { id, name, email, role }, passwordVersion, loggedInAt }`. `passwordVersion`
  is `hashToken(user.passwordHash)` at login time; `server/plugins/auth-session.ts` compares it against
  the current `password_hash` on every session fetch, so **any** password change (reset or profile
  update) invalidates every other session immediately — no server-side session store needed.
- Server helpers (`server/utils/auth.ts`): `requireUser`, `requireAdmin`, `requireShopOwner(event, shopId)`
  (ownership check, admin bypass), `requireApiToken(event, scopes)` (Bearer token, hashed lookup,
  revoked/expired checks, scope check, bumps `last_used_at`) — ready for Phase 6/10.
- Type augmentation for `#auth-utils` lives in `shared/types/auth.d.ts` (both `.d.ts` files under
  `shared/types/` are auto-imported/ambient in app AND server, per Nuxt 4 defaults).

## Rules (shared Zod schemas in `shared/schemas/auth.ts`)

- Full name: 4–24 characters.
- Password: 8–32 characters, at least 1 lowercase, 1 uppercase, 1 digit and 1 special character.
  Signup shows a live checklist of each rule; login/signup password inputs have a show/hide (eye) toggle.

## Flows

- Signup → automatic login. Login errors are generic ("Invalid email or password").
- Forgot password → always returns 200; token = 32 random bytes, stored **hashed**, 1h expiry, single use,
  emailed as `/reset-password?token=...`. A successful reset invalidates other sessions.
- Roles: `user` (buyer + seller) and `admin`. Route middleware: `auth`, `guest`, `admin`.
- API tokens (Phase 10): `mkt_<prefix>_<secret>`, stored hashed, scoped (`products:read`, `products:write`,
  `orders:read`, `orders:write`), revocable. Sent as `Authorization: Bearer <token>`.
- Rate-limit login, signup and forgot-password.
