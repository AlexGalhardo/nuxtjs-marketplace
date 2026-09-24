# Changelog

All notable changes to this project are documented here.
The format follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

Entries are generated with `bun run release` (changelogen).

## Unreleased

### Features
- **catalog:** public `GET /api/products` (search, kind/type/shop/price filters, sort, pagination), `GET /api/products/:slug`, `GET /api/shops/:slug`.
- **ui:** `/marketplace`, `/products/[slug]` and `/shops/[slug]` pages; sitemap lists public products and shops.

### Fixes
- **ui:** header search rendered `[object Promise]` instead of the search box (`<search>` element is unknown to Vue).
