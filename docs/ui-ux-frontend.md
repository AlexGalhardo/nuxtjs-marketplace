# UI / UX / Frontend

- **Components**: follow [design-system.md](design-system.md): own Tailwind components for layout/marketing,
  Nuxt UI only for accessible primitives (re-themed). Use the `nuxt-ui` skill or MCP to pick primitives.
- **Styling**: Tailwind CSS v4 utilities for fine-tuning. Theme colors in `app/app.config.ts`
  (`ui.colors`), design tokens in `app/assets/css/main.css` (`@theme`). No inline styles, no extra CSS frameworks.
- **Layouts** (`app/layouts/`): `default` (header + footer; public pages, auth pages, `/profile`), `my-shop`
  (`default` + the seller section nav, every `/my-shop/**` page), `dashboard` (`UDashboardGroup` + sidebar,
  `/admin/**` only).
- **Forms**: `UForm` + shared Zod schema + `UFormField`; show server errors with `UAlert`/toast.
  Password inputs: `UInput` with a trailing eye button toggling `type` (`aria-label` "Show password"/"Hide password").
- **Data states**: every list has loading (`USkeleton`), empty (`UEmpty` or equivalent) and error states.
- **Accessibility**: labels on every input, visible focus, keyboard navigation, color contrast AA,
  `alt` on product images, `aria-live` for toasts. Audit with the `web-design-guidelines` skill.
- **Responsive**: mobile-first; marketplace filters collapse into a `USlideover` on small screens.
- **Color mode**: light/dark via `UColorModeButton`.
- **Copy**: English, lowercase (visual, via CSS), short, casual and action-oriented.
