# Git workflow

- Remote: `origin` → https://github.com/AlexGalhardo/nuxtjs-marketplace.git. Never push without the owner's OK.
- **Conventional Commits 1.0.0**: `type(scope): subject`, lower-case imperative subject, ≤ 72 chars.
  Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  Scopes (suggested): `auth`, `shop`, `product`, `marketplace`, `cart`, `checkout`, `payments`, `orders`,
  `api`, `admin`, `ui`, `db`, `infra`, `setup`, `ci`, `docs`, `deps`.
  Breaking changes: `feat!:` or a `BREAKING CHANGE:` footer.
- **SemVer 2.0.0**: `0.y.z` during development; `v1.0.0` when PLAN.md Phase 14 is done.
  `feat` → minor, `fix`/`perf` → patch (while `0.x`, breaking → minor). Releases via `changelogen`
  create the tag + `CHANGELOG.md`; pushing a `v*` tag triggers the release workflow.
- **Branches**: `main` is always green. Work on `feat/<scope>-<short-name>` / `fix/...`, open a PR, squash-merge
  with a conventional title.
- **Hooks (Husky, planned — Phase 1.2)**:
  - `pre-commit`: `biome check --staged`
  - `commit-msg`: `commitlint`
  - `pre-push`: typecheck + unit + integration tests
  Never bypass hooks with `--no-verify`.
