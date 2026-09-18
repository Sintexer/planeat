# Roadmap

Shipped through **Sprint 28**. Next sequenced work is **Sprint 29** (fill selected empty slots for a week). Optional Lane B remains. Full Status log: [`docs/sprints/plan.md`](sprints/plan.md). Phase 7 cards: [`docs/sprints/generation.md`](sprints/generation.md).

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

## Done — checkpoint (catalog / Plan UX)

- Shared recipe/simple-food catalog, photo thumbs with offline placeholder, unified Plan screen, old-route redirects.
- Localization settings foundation: `uiLocale`, `measurementPreference` (default as-entered), `Intl` formatting, “usually at home” copy.

## Done — Phase 1 recipe library (Sprints 7–11, checkpoint A)

- Browse restore, simple-food detail, kind/time on cards.
- Household tags with stable IDs (Dexie v6, backup format 6), Vitest.
- Optional dish type and Organization UI.
- Filter drawer (kind, occasion, role, tags, effort) with staged apply.
- Sort/group controls persisted on settings.

## Done — Phase 2 measurements and localization (Sprints 12–17, checkpoint B)

- Unit registry and non-numeric amounts in the manual editor.
- Safe grocery aggregation (legacy cups stay unspecified).
- Display preference applied through `presentForDisplay` / `useFormatQuantity`.
- Locale-scoped ingredient labels and safer alias lookup.
- Import measurement review and catalog matching without auto-creating ingredients.

## Done — Sprint 18 (advanced library filters)

- Maximum recorded total time; contains/exclude catalog ingredients by ID; missing time is not zero; unlinked lines ignored with visible disclaimer.

## Done — Sprint 19 (contextual meal picker)

- Picker sections for leftovers, pairings, favorites, suitable recipes, and All items.
- Add-dish browse state is separate from the Recipes library; short why-this copy when leftover/pairing/favorite/planned-this-week signals exist.

## Done — Sprint 20 / checkpoint C (grocery shopping sections)

- Optional shopping section on ingredients and grocery lines; grouped and flat list views; hide-checked; stable check rows; manual line section pick.
- Unsectioned items stay visible under Other. No aisle maps, pantry tracking, or auto-categorization.

## Done — Sprint 21 (tag lifecycle)

- Archive, merge (live `tagIds` de-duplicated), and delete with affected-item confirmation. Snapshots keep historical label strings. Additive optional `archived` on tags in backups.

## Done — Sprint 22 (saved library views)

- Named views for Recipes query, filters, sort, and grouping; pick / rename / delete; unsaved indicator; explicit Update vs Save as new.
- Live catalog matching; stale archived/deleted tag (and missing ingredient) refs stay visible and do not crash or blank the library.
- Dexie schema v7 (`libraryViews`), backup format 7.

## Done — Sprint 23 (safe restore)

- Restore preflight: validate the file first, show recipe / simple-food / plan / grocery-list counts, optional reliable export date, export current data before replace.
- Invalid or unsupported backups leave local data untouched. Success repeats the same counts. No schema or backup-format bump.

## Done — Sprint 24 (explain grocery quantities)

- Generated lines store meal contributions (cooking event once, including leftover slots; simple-food allocations). Expand **Used by** on the list; incompatible units stay separate; leftover reuse does not double a requirement.
- Link to the planned day when the slot still exists. Additive backup field only.

## Done — Sprint 25 (preview grocery updates)

- Update-from-plan preview before changing an open list: added, changed, no longer required, edited quantities, and checked rows whose amount increases.
- Keep-my-quantity vs use-planned; cancel and create-new leave the existing list untouched. Matching generated rows keep their ids. No schema or backup-format bump.

## Done — Sprint 26A (bulk household tagging)

- Recipes library selection mode: Select / Done, selected count, Clear, Select visible.
- Add tags (create-or-link) or remove tags present on the selection; one Dexie transaction across recipes and simple foods. Snapshots unchanged. Add-dish picker has no checkboxes. No schema or backup-format bump.

## Done — Sprint 27A (library cleanup views)

- Optional Recipes cleanup views: missing meal occasion, dish type, recorded total time, unlinked ingredient lines.
- Maintenance tools only — missing optional metadata is not an error on the main library. Additive `cleanup` on saved views; omitted backup field means none.

## Done — Lane C (Sprints 26C–27C)

- Message catalog, interpolation, plurals, and locale-aware dates/week labels.
- Russian UI language with an explicit Settings control. Household-authored content is not auto-translated.

## Done — Sprint 28 (generate one empty meal)

- Generate on an empty, non-excluded Plan day slot; preview a scaled `complete` recipe for that occasion; Apply uses existing cook-new writes; Cancel persists nothing.
- Session-only proposals with an input fingerprint. Grocery lists do not update as a side effect.

## Next — Phase 7 automatic meal planning (Sprints 29–38)

Local, explainable generation. Proposals only; apply through existing cooking events; grocery lists stay manual. No backend or LLM.

| Gate                     | Sprints | Capability                                       |
| ------------------------ | ------- | ------------------------------------------------ |
| Initial generator        | 28–29   | Fill empty meals with preview and explicit apply |
| Preference-aware planner | 30–32   | Hard restrictions and week-level search          |
| Household meal planner   | 33–35   | Known compositions, leftovers, bounded batches   |
| Core-feature release     | 36–38   | Locks, presets, performance hardening            |

Start household trials on proposals from Sprint 29. Details: [`sprints/generation.md`](sprints/generation.md).

## Later (still out of Phase 7)

Still out of scope unless separately backlogged: backends and sync, nutrition/barcode databases, food ontologies, pantry accounting, additional languages beyond English/Russian, local photo uploads, inferred culinary pairings, automatic grocery updates, cross-week leftover inventory.
