# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Buyers** aged 15–40, browsing on phone or laptop, hunting for second-hand clothes/gear and digital goods
  (presets, templates, e-books) at a good price. They scroll photo grids, filter by price/type, and check the seller.
- **Sellers** (often the same people) clearing out stuff or selling digital files: they open a shop at `/my-shop`,
  list products with photos, connect Stripe to get paid, and ship or deliver downloads.

## Product Purpose

resell.sh lets anyone buy and sell physical and digital products in one multi-seller cart with a single Stripe
Checkout. Success: a buyer finds something in a few taps and pays once; a seller lists in minutes and gets paid out.

## Positioning

A marketplace that feels like a friend's thrift feed, not a department store — Enjoei's playful, lowercase,
photo-first browsing, translated into a terminal/"hacker" identity (resell.sh: "run the resell"). Physical and
digital goods side by side, with a public REST API for sellers.

## Operating Context

Buyers: home page → search/filter (`/marketplace`) → product page → cart/checkout → `/orders` (tracking, downloads, reviews).
Sellers: `/my-shop` dashboard (products, orders to ship or refund, payouts, settings, API tokens/docs). Admins moderate at `/admin` (Phase 11).

## Capabilities and Constraints

- USD only, integer cents; 10% platform fee on item subtotal, charged only when something sells (PLAN.md D3).
- Publishing requires completed Stripe Connect onboarding (D12). Physical items: flat shipping + stock; digital:
  private files delivered via expiring download links (D8).
- Stack fixed: Nuxt 4, Nuxt UI (re-themed, primitives only) + Tailwind v4, Bun. English-only UI copy.
- Not yet built: public API UI (Phase 10), admin (Phase 11).

## Brand Commitments

- Name: **resell.sh**, always lowercase. All UI copy lowercase, casual, short, a little witty (Enjoei voice).
- Visual reference (owner-pinned): enjoei.com.br's structure, spacing, grid and tone; its purple replaced by a
  terminal/matrix green. Light theme by default; dark "terminal" theme via a sun/moon toggle.
- Enjoei's own fonts (Proxima Nova, Enjoei Display) and logo are not used — open equivalents only.

## Evidence on Hand

- No real product photos, testimonials, sales numbers or press. Demo data (`bun run db:seed:demo`) is labeled as
  demo and must never be presented as real activity. Never invent prices, user counts, reviews or coupons.

## Product Principles

1. Photos first: the product image is the page; chrome stays quiet around it.
2. Honest money: show real prices, fees and shipping up front; no fake discounts or urgency.
3. Fast path to act: search, filter and "sell" are always one tap away.
4. Same components for buyers and sellers; the seller area is the same world, just busier.

## Accessibility & Inclusion

WCAG 2.2 AA contrast in both themes, visible focus, full keyboard use, labeled inputs, `alt` on product images,
reduced-motion respected. Lowercase styling is visual only (CSS); form values are never transformed.
