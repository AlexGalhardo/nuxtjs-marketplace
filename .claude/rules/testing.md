---
paths:
  - "tests/**"
  - "playwright.config.ts"
  - "vitest.config.ts"
---

# Tests (docs/testing.md)

- Every feature ships with tests at the right level: unit (`tests/unit`), integration against the built server
  (`tests/integration`), smoke and e2e (`tests/e2e`, Playwright), QA/pentest (`tests/qa`).
- Bug fix = a test that fails before the fix.
- Tests write to `.data-test`, never to the dev database; generate unique emails/slugs per test.
- No `.only`, no skipped tests to make CI green, no sleeps: wait on a condition.
- Integration files share one server and one SQLite file (`fileParallelism: false`); keep them independent of order.
