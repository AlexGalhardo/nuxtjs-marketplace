## What and why

<!-- What changes, and the problem it solves. Link the issue: Closes #123 -->

## How it was tested

<!-- Commands you ran and their result. -->

- [ ] `bun run check && bun run typecheck && bun run test:unit`
- [ ] Integration / e2e tests for the area touched (`bun run test:integration`, `bun run test:e2e`)

## Checklist

- [ ] PR targets `dev`, title follows Conventional Commits (`type(scope): subject`)
- [ ] Tests added or updated (regression test for bug fixes)
- [ ] `CHANGELOG.md` line under `## [Unreleased]`
- [ ] Docs updated (`docs/`, PLAN.md checkboxes) when behavior or setup changed
- [ ] Money: integer cents, server-side pricing, `logTransaction()`, idempotency keys (if payments touched)
- [ ] Both DB schemas and migrations updated together (if the schema changed)
- [ ] UI checked in light and dark themes and at 390px width (if UI changed)
- [ ] No new dependency, or it is approved and listed in PLAN.md §2
