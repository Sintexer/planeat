# Roadmap

Shipped through **Sprint 38** (38a worker reliability, 38b fixtures/invariants). Device measurement and search tuning are postponed. Optional Lane B remains. Full Status log: [`docs/sprints/plan.md`](sprints/plan.md). Phase 7 cards: [`docs/sprints/generation.md`](sprints/generation.md).

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

## Done — Sprint 29 (week generate)

- Select empty meals for the open week; search runs in a Web Worker; preview can be partial; Apply writes filled slots in one transaction.
- Existing meals and exclusions stay put. Grocery lists still do not update as a side effect.

## Done — Sprint 30 (strict eligibility)

- Household hard-generation policy: excluded recipes, required/excluded tags, include/exclude ingredients by id, optional max recorded total time, unknown-time and unknown-ingredient enums.
- Candidate filter never relaxes a restriction; missing time is not zero; unlinked lines follow the unknown-ingredient policy. Diagnostics list facet drop counts and conflicting filled meals without rewriting them.
- Settings UI plus additive backup field on the settings row. Missing catalog ids are reported and kept. No Dexie or backup-format bump.

## Done — Sprint 31 (preferences and scoring)

- Among hard-eligible recipes, pick by a versioned lexicographic score: quick-meal days, effort, repetition (including `maxPreferredRepeats`), prep-unit workload, vegetables, preferred generation tags, preferred prep days.
- Missing recorded time is not treated as fastest. Previous-week planned dishes count as planned history. Preview lists score reasons. Additive `generationPreferredTagIds`. No beam search. No Dexie or backup-format bump.

## Done — Sprint 32 (bounded weekly search)

- Chronological beam search over requested empty slots with a lexicographic week score (coverage before preference penalties).
- Household search budget (beam width, per-slot candidate limit, expansion budget) on Settings; additive backup; proposal records budget used. Exhaustion yields `search-incomplete`, not infeasibility.
- Same snapshot + seed + version + budget is deterministic. No Dexie or backup-format bump.

## Done — Sprint 33 (known multi-component meals)

- Generate can propose a stored favorite, a stored pairing, a standalone complete recipe, or an enabled simple food. It does not invent main+side combinations.
- Suggestion-disabled simple foods are not standalone picks; they may still appear inside a known composition.
- Apply writes mixed cook-new and simple-food components in one transaction. Additive `generationCompositionBounds`. No Dexie or backup-format bump.

## Done — Sprint 34 (allocate existing leftovers)

- Generate may fill later empty meals with remaining portions of existing same-week cooking events, after reuse policy and already-planned allocations.
- Stored event output is unchanged. Apply links leftover in the same transaction as other generated components. Grocery lists stay untouched until the cook later generates/updates a list.

## Done — Sprint 35 (new batches and planned reuse)

- Generate may cook extra portions on a new cooking event and reuse them later in the same week, within extra-use and unallocated-production settings.
- Apply creates the event once and links later meals. Grocery lists stay untouched. Additive `generationBatchPolicy`. No Dexie or backup-format bump.

## Done — Sprint 36 (lock and replace selected meals)

- Slot-level generation lock on Plan and the meal editor. Locked meals are never filled or replaced.
- Fill-empty stays the default. Replace selected (week modal or regenerate on a filled slot) requires confirming leftover dependents; a locked dependent blocks destructive regeneration.
- Preview lists removals; Apply clears then writes in one transaction. Grocery lists stay untouched. Additive `generationLocked` on meal slots. No Dexie or backup-format bump.

## Done — Sprint 37 (reusable generation presets)

- Built-in Balanced / Less cooking / More variety / Batch cooking snapshots plus custom named presets on the same generation policy fields as Settings.
- Generate meals preset bar: request-only drafts, dirty indicator, Save as new, Update (custom only). Generate does not write Settings.
- Dexie schema v8 (`generationPresets`), backup format 8. `algorithmVersion` stays `36`.

## Done — Sprint 38 (reliability and invariants)

- Worker failure is recoverable (`worker-failed`); Cancel terminates and recreates the worker; page-session token in the fingerprint.
- Named generation fixtures and handwritten invariants (`generationQuality.test.ts`). No Dexie or backup-format bump. `algorithmVersion` stays `36`.

## Later — postponed performance work

Do not tune beam width, expansion budget, caches, or worker memory, and do not invent device or cancel-latency budgets, until there is a named-device measurement. Optional local-improvement pass stays with that later work.

Phase 7 sequenced generation (Sprints 28–38) is shipped: proposals only; apply through existing cooking events; grocery lists stay manual. No backend or LLM. Household trials can continue. Details: [`sprints/generation.md`](sprints/generation.md).

## Later (still out of Phase 7)

Still out of scope unless separately backlogged: backends and sync, nutrition/barcode databases, food ontologies, pantry accounting, additional languages beyond English/Russian, local photo uploads, inferred culinary pairings, automatic grocery updates, cross-week leftover inventory.
