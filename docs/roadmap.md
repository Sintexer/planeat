# Roadmap

## Done — project initialization

- Vite + React + TypeScript scaffold (bun tooling).
- Mantine UI, forms, dates, notifications; Tabler icons.
- App shell: header, bottom nav (Plan / Groceries / Recipes / Settings), `HashRouter`. (Today/Week were merged into Plan; old routes redirect.)
- Dexie database v1 (`recipes`, `settings`) with a minimal recipe create/list flow proving persistence.
- `vite-plugin-pwa` configured with a prompted-update flow; production build precaches the app shell.
- ESLint + TypeScript strict checks; `docs/`, `AGENTS.md`.

## Done — recipe library (Sprint 2)

- Full recipe create/edit/detail with yields, roles, meal types, effort, reuse, freezer metadata, instructions.
- Ingredient catalog with aliases and create-or-link from the recipe editor.
- Simple foods + enable-in-suggestions checklist.
- Quantity scaling preview (`fraction.js` behind `QuantityService`).
- Dexie schema v2 and backup format version 2.

## Done — weekly planning (Sprint 3)

- Navigable seven-day plans (one per week start), configurable week-start day.
- Breakfast/lunch/dinner slots with empty vs excluded styling.
- Single-item placement: recipe (cooking event + snapshot) or simple food.
- Seven-day planning UI (later unified on Plan; Dexie schema v3 and backup format version 3).

## Done — grocery-list objects (Sprint 4)

- Standalone open/closed grocery lists with checkable items.
- Generate from week plan (cooking events + simple foods); common ingredients start checked.
- Pragmatic update-existing merge (replace generated lines, keep manual items and matching checks).
- Dexie schema v4, backup format version 4, `convert-units` behind `QuantityService.add`.

## Done — Sprint 5 (batch reuse + remainder)

- Multi-component meal editor; cook-new vs use-existing prep; allocation / reuse enforcement; dependency-aware remove/clear.
- Auto prep sessions by date with effort units (`Prep · 1.5`); meal favorites; recipe pairings; `fuse.js` Suggested picker; soft planning prompts via global Settings.
- Dexie schema v5, backup format version 5.

## Done — Sprint 6 (structured recipe imports)

- JSON/JSON-LD paste and file import (`@mantine/dropzone` + visible Choose file); HTML with embedded `application/ld+json`.
- Schema.org Recipe extraction (Zod runtime + `schema-dts` types); multi-recipe pick-one; prefill `RecipeEditor` with hints.
- No network fetch; imported recipes save like manual ones. No Dexie schema bump.

## Next — checkpoint, then Sprints 7–9

Finish the current UX branch (shared dish catalog, photo thumbs, unified Plan) **before** measurement schema work.

Then:

1. **Sprint 7** — Household polish + localization foundation (`uiLocale`, as-entered measurement preference, `Intl` formatting, “usually at home” copy, photo/offline rules).
2. **Sprint 8** — Explicit unit registry and conservative grocery aggregation (highest-value outcome).
3. **Sprint 9** — Localized ingredient labels/aliases and import match-and-confirm quality.

Sequence: [`docs/sprints/plan.md`](sprints/plan.md).

Still out of scope: automatic weekly generation, backends, nutrition/barcode databases, food ontologies, pantry accounting.
