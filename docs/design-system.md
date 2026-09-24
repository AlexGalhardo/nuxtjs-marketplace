# resell.sh design system

Source of truth for tokens: `app/assets/css/main.css` (+ Nuxt UI re-theme in `app/app.config.ts`).
Product voice and principles: [PRODUCT.md](../PRODUCT.md).

## Identity
- Enjoei-inspired structure (photo grids, row mosaics, lowercase playful copy) re-cast as a terminal:
  wordmark `resell.sh` in mono with a blinking block cursor (`AppLogo`, the only idle animation).
- **Lowercase is visual only**: `body { text-transform: lowercase }`; inputs, code and `.normal-case` keep real case.
- Light theme default; dark "terminal" theme via `UColorModeButton` (`.dark` overrides in `main.css`).

## Tokens
- Colors: `matrix` (brand green, Nuxt UI `primary`) and `ink` (green-tinted neutrals, Nuxt UI `neutral`).
  Primary is `matrix-800` in light, `matrix-400` in dark.
- Roles: `--rs-signal`/`--rs-signal-ink` (phosphor green: promo bar, "instant download" tags, selection),
  `--rs-selected`/`--rs-selected-ink` (soft green: active filters, photo-less tiles).
- Type: `Figtree` (UI), `Big Shoulders Display` (`font-display`, typographic product tiles), `JetBrains Mono`
  (wordmark, slugs, code — never as decoration).
- Shape: `--ui-radius` 0.5rem; buttons `rounded-full`, fields `rounded-xl`, photos `rounded-lg`.
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
