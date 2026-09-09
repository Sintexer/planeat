# Roadmap

## Done — project initialization

- Vite + React + TypeScript scaffold (bun tooling).
- Mantine UI, forms, dates, notifications; Tabler icons.
- App shell: header, bottom nav (Today / Week / Lists / Recipes), `HashRouter`.
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
- Today and Week screens; Dexie schema v3 and backup format version 3.

## Done — grocery-list objects (Sprint 4)

- Standalone open/closed grocery lists with checkable items.
- Generate from week plan (cooking events + simple foods); common ingredients start checked.
- Pragmatic update-existing merge (replace generated lines, keep manual items and matching checks).
- Dexie schema v4, backup format version 4, `convert-units` behind `QuantityService.add`.

## Done — Sprint 5 (batch reuse + remainder)

- Multi-component meal editor; cook-new vs use-existing prep; allocation / reuse enforcement; dependency-aware remove/clear.
- Auto prep sessions by date with effort units (`Prep · 1.5`); meal favorites; recipe pairings; `fuse.js` Suggested picker; soft planning prompts via global Settings.
- Dexie schema v5, backup format version 5.

## Next — Sprint 6

Structured recipe imports — see `docs/sprints/plan.md`.
