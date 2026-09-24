# UI / UX / Frontend

- **Components**: always Nuxt UI first (`U*` components, see https://ui.nuxt.com/docs/components).
  Use the `nuxt-ui` skill or the Nuxt UI MCP to pick components. Custom components only compose Nuxt UI.
- **Styling**: Tailwind CSS v4 utilities for fine-tuning. Theme colors in `app/app.config.ts`
  (`ui.colors`), design tokens in `app/assets/css/main.css` (`@theme`). No inline styles, no extra CSS frameworks.
- **Layouts**: `default` (header + footer), `auth` (centered card for login/signup/reset),
  `dashboard` (`UDashboardGroup` + sidebar for `/my-shop` and `/admin`).
- **Forms**: `UForm` + shared Zod schema + `UFormField`; show server errors with `UAlert`/toast.
  Password inputs: `UInput` with a trailing eye button toggling `type` (`aria-label` "Show password"/"Hide password").
- **Data states**: every list has loading (`USkeleton`), empty (`UEmpty` or equivalent) and error states.
- **Accessibility**: labels on every input, visible focus, keyboard navigation, color contrast AA,
  `alt` on product images, `aria-live` for toasts. Audit with the `web-design-guidelines` skill.
- **Responsive**: mobile-first; marketplace filters collapse into a `USlideover` on small screens.
- **Color mode**: light/dark via `UColorModeButton`.
- **Copy**: English, sentence case, short and action-oriented.
