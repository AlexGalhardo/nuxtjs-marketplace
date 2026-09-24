# Coding conventions

- **English everywhere**: identifiers, comments, UI copy, URLs, commit messages, docs.
- **Formatting/linting**: Biome 2 is the only linter/formatter. Run `bun run check` before committing.
- **TypeScript strict**. No `any`; prefer inferred Drizzle types and `z.infer`.
- **Vue**: `<script setup lang="ts">`, Composition API, auto-imports (don't import `ref`, `useFetch`, components).
- **Data fetching**: `useFetch`/`useAsyncData` for SSR data in pages; `$fetch` for user actions.
  Never call `$fetch` at the top level of `setup` for initial data (double fetch).
- **State**: `useState` for shared SSR-safe state. No Pinia unless PLAN.md is updated.
- **Validation**: one Zod schema per input in `shared/schemas`, reused by `UForm` and the server
  (`readValidatedBody(event, schema.parse)`).
- **Money**: integer cents; format only at the edge with `formatMoney()`.
- **Errors**: the server throws `createError`; the UI shows `useToast()` or an inline `UAlert`.
- **Comments**: explain *why*, not *what*. Keep them short.
- **Security**: never trust client prices/totals; recompute on the server. Authorize every
  resource by owner. Never log secrets, card data or unnecessary PII.
