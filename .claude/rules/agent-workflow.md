# Agent workflow (every task)

- **Mandatory skills** for any maintenance or evolution of this codebase, loaded before the first edit:
  - `andrej-karpathy-skills:karpathy-guidelines`: state assumptions, simplest change, surgical diffs, verifiable goal.
  - `ponytail`: least code that works; reuse what already lives in the repo before writing new code.
  - `graphify`: answer architecture/"where is X" questions from `graphify-out/graph.json`
    (`graphify query "<question>"`); after structural changes run `/graphify . --update`.
  - Plus the area skills from CLAUDE.md (UI work: `impeccable`, `nuxt-ui`, `web-design-guidelines`, ...).
- **PLAN.md is the task state.** Before starting, find the phase/task there; tick `[x]` (or `[~]`) as work lands so
  the next session can resume. New work gets a checklist entry first.
- **CHANGELOG.md** (Keep a Changelog): add a line under `## [Unreleased]` in the same commit as the change.
- **Branches**: commit to `dev`, push `dev`, wait for its `ci` run to pass (`gh run watch`), then
  `git push origin dev:main`. Never push to `main` with a red or running `dev` pipeline. Never `--no-verify`.
- **Worktrees for parallel work** (owner, 2026-10-02): when a task is truly independent (no shared files, ports or
  `.data*` DB with the main work), run it in a git worktree (`Agent` with `isolation: "worktree"`, or
  `git worktree add ../resell-<task> dev`) so it doesn't disturb the main tree. Only when it saves time; merge back
  through `dev`, then remove the worktree (`git worktree remove`).
- **Done means verified**: `bun run check && bun run typecheck && bun run test:unit`, plus the integration/e2e
  test of the area you touched. Show the command and its result.
- **Owner-only actions** (accounts, keys, dashboards) never block work: add them to PLAN.md "Developer actions".
