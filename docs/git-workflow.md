# Git workflow

- Remote: `origin` → https://github.com/AlexGalhardo/nuxtjs-marketplace.git.
- **Conventional Commits 1.0.0**: `type(scope): subject`, lower-case imperative subject, ≤ 72 chars.
  Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  Scopes (suggested): `auth`, `shop`, `product`, `marketplace`, `cart`, `checkout`, `payments`, `orders`,
  `api`, `admin`, `ui`, `db`, `infra`, `setup`, `ci`, `docs`, `deps`.
  Breaking changes: `feat!:` or a `BREAKING CHANGE:` footer.
- **SemVer 2.0.0**: `feat` → minor, `fix`/`perf` → patch, breaking → major. `v1.0.0` shipped 2026-09-26.
- **Branches**: `dev` is the sandbox, `main` is production. Push to `dev` first; promote the same commits to
  `main` (fast-forward, `git push origin dev:main`) only after the whole `ci` run on `dev` is green. Never push to
  `main` directly. Both branches run `ci`; only `main` gets tagged and deployed.
- **Hooks (Husky, `.husky/`)**, installed by `bun install` (`prepare` script):
  - `pre-commit`: `biome check --staged` (fix with `bun run check:fix`)
  - `commit-msg`: `commitlint` (`commitlint.config.js`; unknown scopes only warn)
  - `pre-push`: `typecheck` + `test:unit` + `test:integration` (takes a few minutes)
  Never bypass hooks with `--no-verify`.
- **Changelog**: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Every user-visible change adds a line
  under `## [Unreleased]` (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) in the same commit.
- **Release** (from `main`, after promoting): `bun run release <patch|minor|major>` moves `[Unreleased]` into
  `## [x.y.z] - date`, bumps `package.json` (shown in the footer), commits `chore(release): vx.y.z` and tags;
  then `git push --follow-tags origin main` and `git push origin main:dev`. The tag publishes the GitHub
  Release (notes = that CHANGELOG section) and the GHCR images.
