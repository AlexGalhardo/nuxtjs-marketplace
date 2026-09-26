# resell.sh design system

Source of truth for tokens: `app/assets/css/main.css` (+ Nuxt UI re-theme in `app/app.config.ts`).
Product voice and principles: [PRODUCT.md](../PRODUCT.md).

## Identity

- Enjoei-inspired structure (photo grids, row mosaics, lowercase playful copy) re-cast as a terminal:
  wordmark `resell.sh` in mono (`AppLogo`), static: no blinking cursor (owner request, 2026-09-26).
- **Lowercase is visual only**: `body { text-transform: lowercase }`; inputs, code and `.normal-case` keep real case.
- Light theme default; dark "terminal" theme via `UColorModeButton` (`.dark` overrides in `main.css`).

## Tokens

- Colors: `matrix` (brand green, Nuxt UI `primary`) and `ink` (green-tinted neutrals, Nuxt UI `neutral`).
  Primary is `matrix-800` in light, `matrix-400` in dark.
- Roles: `--rs-banner`/`--rs-banner-ink`/`--rs-banner-edge` (large brand surfaces: promo bar, home hero; neon in
  light, a phosphor "terminal screen" — `matrix-400` on `matrix-950` — in dark, where a neon block glared),
  `--rs-signal`/`--rs-signal-ink` (small neon accents: "instant download" tags, cart badge, selection),
  `--rs-selected`/`--rs-selected-ink` (soft green: active filters, photo-less tiles).
- Type: `Figtree` (UI), `Big Shoulders Display` (`font-display`, typographic product tiles), `JetBrains Mono`
  (wordmark, slugs, code — never as decoration).
- Contrast floor (measured): text ≥ 4.5:1, form field outlines (`--ui-border-accented`) ≥ 3:1 in both themes,
  `--ui-success` is `success-700` in light (5:1). `color-scheme` follows the theme (native controls, scrollbars) and
  `<meta name="theme-color">` matches the promo bar. Alerts default to the `subtle` variant (never a solid block).
- Shape: `--ui-radius` 0.5rem; buttons `rounded-full`, form fields **square** (`rounded-none`, `app.config.ts`), photos `rounded-lg`.
  Form pages (`/login`, `/signup`, `/contact`, `/profile`, password reset) also use square cards and submit buttons.
- Layouts: `default` (header + footer) for every public, buyer and seller page; `/my-shop/**` adds a section nav
  (`layouts/my-shop.vue`); only `/admin/**` keeps the `dashboard` layout.
- Layout: `rs-container` (75rem + 1.5rem gutters), header height `--ui-header-height` 4.5rem.

## Components

- Own Tailwind components for layout/marketing: `AppHeader`, `AppFooter`, `SectionHeader`,
  `Product/Card`, `Product/Mosaic`, `Product/Photo` (photo, or a lettered tile when no photo exists).
- Nuxt UI only for accessible primitives (buttons, forms, menus, popovers, pagination, toasts), re-themed.
- Numbers in prices/counts use `tabular-nums`; money always through `formatMoney` (integer cents).

## Rules

- Photos first; chrome stays quiet. No fake discounts, counts or reviews (show "no reviews yet").
- Every list: loading (`USkeleton`), empty (friendly lowercase message + a way out), error states.
- WCAG 2.2 AA in both themes, visible `:focus-visible` ring, reduced motion respected.
