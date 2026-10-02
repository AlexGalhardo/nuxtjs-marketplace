---
paths:
  - "app/**"
---

# Frontend (docs/ui-ux-frontend.md, docs/design-system.md)

- Load `impeccable` before any UI edit, plus `interface-design` (app UI) or `frontend-design` (marketing) and
  `nuxt-ui`; audit with `web-design-guidelines` before closing the task.
- resell.sh voice: lowercase copy, terminal green, light default + dark toggle. Check both themes and 390px width
  (no horizontal scroll, exactly one `h1` per page).
- Own Tailwind v4 components for layout/marketing; Nuxt UI only for accessible primitives, re-themed in
  `app/app.config.ts`.
- Data through `useFetch`/`$fetch` against our own API; no `v-html` with user content.
- Every icon-only control has an `aria-label`; every input has a visible label.
