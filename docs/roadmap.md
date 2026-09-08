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

## Next — weekly planning (Sprint 3)

See `docs/sprints/plan.md`.
