# Architecture

Local-first PWA. No backend service.

## Stack

| Concern            | Decision                                                                   |
| ------------------ | -------------------------------------------------------------------------- |
| Language           | TypeScript, strict mode                                                    |
| Runtime/tooling    | Node 22 LTS, bun                                                           |
| UI framework       | React                                                                      |
| Build tool         | Vite                                                                       |
| UI and forms       | Mantine                                                                    |
| Icons              | Tabler Icons                                                               |
| Routing            | React Router, `HashRouter`                                                 |
| Local persistence  | IndexedDB via Dexie                                                        |
| Reactive queries   | `dexie-react-hooks`, behind `ui/hooks/*`                                   |
| Runtime validation | Zod                                                                        |
| Dates              | Day.js; meal dates stored as local `YYYY-MM-DD` strings                    |
| Offline/PWA        | `vite-plugin-pwa` (Workbox `generateSW`)                                   |
| Styling            | Mantine theme tokens + CSS Modules                                         |
| Static checks      | TypeScript + ESLint (incl. `eslint-plugin-boundaries`) + Prettier          |
| Tests              | None until Sprint 8 (tag identity); measurement/grocery gates in Sprint 13 |

## Layers

```
src/
  app/              bootstrap, router, providers, theme — composition root
  domain/           pure types and rules, no React/Dexie
  application/      use-case services + repository contracts (ports)
  infrastructure/   Dexie database, repository implementations, PWA glue
  ui/               layouts, screens, components, hooks
```

Dependency direction: `ui → application → domain`, `infrastructure → application ports + domain`.
UI never touches Dexie tables directly — always through a `ui/hooks/*` hook or an application service reached via `useServices()`.

## State management

No Redux/Zustand/TanStack Query. Dexie is the source of truth for persisted data (recipes, plans, lists, settings); `@mantine/form` holds unsaved drafts; React context (`servicesContext.ts`) exposes application services; `dexie-react-hooks` keeps views live.

## Offline

Service worker caches the app shell (HTML/JS/CSS/icons) only — user data always lives in IndexedDB, never in the SW cache. Updates are prompted, never forced (`src/infrastructure/pwa/UpdatePrompt.tsx`). PWA icons (`public/pwa-*.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`) are generated from `public/favicon.svg` by `@vite-pwa/assets-generator` (`pwa-assets.config.ts`, `bun run generate-icons`) — re-run it after replacing the source SVG with real branded artwork, and inspect the maskable icon's crop on Android, since generation doesn't guarantee a good result.

## Supportive libraries

Beyond the core stack, the goal is maximum functionality reused without inflating the dependency count — see `AGENTS.md`'s "Libraries" section for the concrete list of what's installed now versus earmarked for a later sprint, and check that list before adding a new package or writing a generic helper.

Decisions of note:

- **`@mantine/modals`**, not ad hoc modal state per screen — centralizes confirmations (backup restore, future recipe deletion, dependent-meal edits, grocery-list overwrites).
- **`fraction.js` + `convert-units`** (Sprints 2 and 4) handle quantity _arithmetic_ only — recipe scaling and compatible-unit aggregation. They do not, and must not be made to, infer package sizes, cooked-vs-dry weight, or interchangeability between different recipes' "servings". Wrap them behind a small `QuantityService` adapter (`scale`/`add`/`format`) so package-specific APIs stay out of the rest of the app; persist plain serializable `Quantity` values (`{ value, unit }`), never library instances.
  - **Known limitation:** `cup-metric` has no convert-units equivalent, so `QuantityService` only aggregates it with another exact `cup-metric`. Legacy `cup`/`tbsp` also stay self-only (Sprint 13) — they are never treated as US customary by default. Do not add alias-map entries to paper over US vs metric cups.
- **`fuse.js`** (Sprint 5) is a search/ranking aid for the recipe and component pickers — never a basis for merging ingredient identity. Fuzzy match quality and ingredient-identity correctness are different problems. Search may later include localized labels; matching still proposes candidates only.
- **`schema-dts`** (Sprint 6) gives compile-time Schema.org `Recipe` types for JSON-LD import; it validates nothing at runtime. Zod stays the runtime-validation layer for imported/normalized data, same as it already is for backups (`src/application/backup/backupSchema.ts`).
- **`eslint-plugin-boundaries`** enforces the layering above with a few coarse rules (see `eslint.config.js`), not a full architectural policy — it's meant to catch an accidental `ui → infrastructure` import, particularly valuable once more than one agent/contributor is touching the codebase.
- Ingredient-line parsing (`"2 × 400 g cans chopped tomatoes, drained"`) stays conservative by design: preserve the original line (`sourceText`), parse only the obvious quantity/unit via `UnitRegistry` (Sprint 16), require confirmation on cups/tablespoons/ounces, and leave unresolved ranges and non-numeric amounts as `quantityText` — no ingredient parser package is adopted sight-unseen.
- **Ingredient identity is the ID**, not the display name. Aliases and translations are metadata. Do not stamp existing aliases with the device locale during migration.
- **Localization is presentation.** `uiLocale` and `measurementPreference` (default **as-entered**) must not reinterpret stored quantities, snapshots, or week-start dates. Format numbers with `Intl` in UI; keep arithmetic in domain.
- **Grocery aggregation** combines lines only when ingredient identity, purchasing form, dimension, and a known conversion all match. Group leftover incompatible amounts under the same ingredient instead of guessing. Cooking-event snapshots remain the source of generated requirements; leftover reuse must not double-count.
- **No food ontology / nutrition / barcode runtime** in the current sequence. Bundle any unit labels or message catalogs needed for offline use. Record license/version if copying reference data.
- Shared dish catalog UI may search recipes and simple foods together; they remain separate domain types and Dexie stores.
