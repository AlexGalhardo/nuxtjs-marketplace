---
paths:
  - "server/**"
  - "shared/schemas/**"
---

# Server security (docs/security.md, OWASP Top 10:2025)

- Every protected handler starts with `requireUser`/`requireAdmin`/owner helpers; check ownership of every id it
  receives and answer another user's resource with 404. Add the integration test that proves it.
- Validate body, query and params with the shared Zod schemas (`readValidatedBody`, `getValidatedQuery`).
- Drizzle query builder or bound `sql` templates only; never interpolate input into SQL.
- Errors: `createError` with a safe `statusMessage`; no stack traces, SQL or Stripe messages in responses.
- Never log tokens, passwords, cookies, emails or Stripe secrets; secrets only in server `runtimeConfig`.
- New mutating route reached by cookies: it is covered by `server/middleware/csrf.ts`; new public or abusive
  route: add a `routeRules` rate limit.
- New library: only with owner approval, listed in PLAN.md §2.
