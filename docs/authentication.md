# Authentication (planned — Phase 4)

- `nuxt-auth-utils`: sealed cookie session (`NUXT_SESSION_PASSWORD`, at least 32 chars).
  Server: `setUserSession`, `requireUserSession`, `clearUserSession`, `hashPassword`, `verifyPassword`.
  Client: `useUserSession()` (`loggedIn`, `user`, `fetch`, `clear`).
- Session payload: `{ user: { id, name, email, role } }`, never secrets.

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
