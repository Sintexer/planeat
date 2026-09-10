# Feature-specific sprint plan

No dates. Each sprint ends with a usable increment and concrete completion criteria.

Sprints 1–6 had no automated test runner (MVP). Sprint 7 stays polish-and-foundation. Automated tests around realistic household scenarios become in scope with Sprint 8 (measurement/grocery correctness). See [`docs/superpowers/specs/2026-09-10-identity-measurement-localization.md`](../superpowers/specs/2026-09-10-identity-measurement-localization.md).

## Sprint 1 — Offline application foundation

**Build**

- React/Vite/TypeScript setup.
- Navigation shell.
- Dexie database and migration mechanism.
- PWA manifest and offline application shell.
- Backup export and validated restore.
- Basic settings.

**Complete when**

- The app can be installed on Android.
- It opens without a server connection after setup.
- Local data survives reloads and app restarts.
- A backup can be exported and restored.

---

## Sprint 1.5 — Supportive libraries and tooling

Not a product-facing sprint — brings in the small set of FOSS libraries and dev tooling identified for the rest of the roadmap, before Sprint 2 starts. See `AGENTS.md`'s "Libraries" table and `docs/architecture.md`'s "Supportive libraries" section for the full rationale and what's still deferred.

**Build**

- `@mantine/modals` wired in and adopted for the backup-restore confirmation (the first of several confirmation dialogs the roadmap needs).
- `eslint-plugin-boundaries` enforcing the layering rules already documented in `AGENTS.md`.
- Prettier, with a format script.
- `@vite-pwa/assets-generator` generating real PWA icon sizes (incl. maskable) from the existing source SVG.
- Dependency decisions for later sprints recorded (not installed yet): `fuse.js`, `@mantine/dropzone`, `schema-dts`. `fraction.js` and `convert-units` are installed.

**Complete when**

- `bun run lint` fails on a deliberately introduced `ui → infrastructure` import.
- `bun run format:check` passes on the whole repo.
- The PWA manifest references generated PNG/maskable icons, not just the single source SVG.
- A confirmation dialog (backup restore) goes through `@mantine/modals` instead of screen-local modal state.

---

## Sprint 2 — Recipe and simple-food library

**Build**

- Manual recipe creation/editing.
- Ingredient catalog with aliases.
- Quantities, yields, roles, and meal types.
- Effort and reuse metadata.
- Freezer-friendly flag and notes.
- Simple-food management and enabled checklist.
- Local recipe detail screen.

**Complete when**

- You can enter cutlets, soup, carbonara, and several sides.
- Recipe quantities can be scaled (`fraction.js`).
- Yogurt can be disabled as a standalone suggestion.
- Instructions remain readable offline.

---

## Sprint 3 — Basic manual weekly planning

**Build**

- Seven-day plans.
- Configurable start day.
- Breakfast/lunch/dinner slots.
- Nonrecurring exclusions.
- Single-dish meal placement.
- Cooking-event creation behind each prepared dish.
- Today and Week screens.

**Complete when**

- You can manually plan a week for two.
- Excluding Friday dinner affects only that plan.
- Meals reference saved recipe snapshots.
- Editing a library recipe does not silently rewrite an existing plan.

This establishes the cooking-event model before introducing reuse.

---

## Sprint 4 — Grocery-list objects

**Build**

- Standalone grocery lists.
- Generation from a plan.
- Ingredient scaling and compatible-unit aggregation (`convert-units`, wrapped behind a `QuantityService` adapter).
- Common ingredients initially crossed out.
- Arbitrary items and quantity editing.
- Close/reopen lists.
- Explicit update-existing versus create-new flow.

**Complete when**

- A week produces an editable saved list.
- Salt remains visible but prechecked.
- Users can uncheck it and add non-food items.
- Plan changes do not silently overwrite the list.

At this point, the app already provides a useful manual planning workflow.

---

## Sprint 5 — Components, batches, and favorite meals

**Build**

- Multi-component meal editor.
- Reuse of cooking-event output across meals.
- Allocation checks and unused-output warnings.
- Preparation sessions and effort-unit calculation.
- Dependency-aware move/delete flows.
- Favorite assembled meals.
- Pairing suggestions and a recipe/component picker (`fuse.js` for fuzzy search — never used to merge ingredient identity).
- Quick-day, repetition, workload, and vegetable prompts.

**Complete when**

- Twelve cutlets can supply three meals with different sides.
- Their ingredients appear once in the grocery calculation.
- Soup can cover three lunches.
- Fresh-only carbonara cannot be assigned as a later leftover.
- Removing shared preparation identifies every affected meal.
- Two batch dishes in one session contribute 1.5 effort units.

---

## Sprint 6 — Structured recipe imports

**Build**

- JSON/JSON-LD paste and file import (`@mantine/dropzone` for the file picker/drop target — always paired with a visible picker button, never drag-and-drop-only, for Android).
- Schema.org `Recipe` extraction (typed via `schema-dts`, validated at runtime with Zod).
- Multiple-recipe selection.
- Ingredient and yield confirmation.
- Source retention.
- Clear unsupported-format and ambiguous-field feedback.

**Complete when**

- Supported recipe data can be imported without a backend.
- Missing fields can be completed before saving.
- The resulting recipe behaves exactly like a manually entered recipe.
- No live website access is required to read it afterward.

---

## Checkpoint — finish the current UX branch (before Sprint 7 schema work)

Uncommitted catalog, photo UI, and unified Plan screen must stand on their own. Do not mix them with measurement schema changes.

**Build / verify**

- Commit the shared dish catalog, photo UI, and unified Plan screen.
- Verify redirects from `/today` and `/week` (and `/week/:planId`) to `/plan`.
- Regression-check cooking events, leftover reuse, and grocery generate/update.
- Verify installation, offline operation, and the PWA update prompt.
- Export a representative **v5** backup for later migration tests.

**Complete when** those UX changes ship independently of identity/unit work.

---

## Sprint 7 — Household polish and localization foundation

Implementation plan: [`docs/superpowers/plans/2026-09-10-sprint-7-household-polish.md`](../superpowers/plans/2026-09-10-sprint-7-household-polish.md).

Household-use polish plus settings and formatting foundations. **No unit-registry schema yet.** Confirm the current quantity model (see the identity spec) before Sprint 8.

**Build**

- Faster recipe/component selection, better mobile quantity editing, empty states and validation messages.
- Clear distinction between excluded and unplanned meals.
- Grocery-update preview refinements.
- Settings organization; offline/update status feedback.
- Small starter guidance, without forcing a bundled recipe library.
- `uiLocale` (only supported UI languages at first) and `measurementPreference` defaulting to **as-entered**.
- Translation/message infrastructure; centralized number and quantity **formatting** (`Intl` in UI; no arithmetic in the browser locale).
- Clearer wording for `isCommon`: “Usually have at home — starts checked on new grocery lists” (not pantry tracking).
- Audit real stored/imported units and aliases.
- Short ADRs (or spec sections) for ingredient identity, unit semantics, and snapshot preservation.
- Defined photo behavior: URL photos optional; reliable offline placeholder; backups do not include remote image bytes.

**Complete when**

- The entire workflow is comfortable on an Android phone: plan, reuse batches, generate groceries, shop, close the list.
- Errors explain what to fix instead of hiding invalid dependencies.
- Changing locale does not change quantities, ingredient IDs, dates, or week boundaries.
- Current recipes and plans still display correctly.
- Calendar dates remain local `YYYY-MM-DD`; no accidental UTC conversion during formatting.
- Unsupported translations fall back cleanly.

---

## Sprint 8 — Explicit measurements and reliable groceries

Highest-value outcome: grocery lists that only combine quantities when identity, form, dimension, and conversion are all known.

**Build**

- Bundled, versioned unit registry in domain; explicit unit selection for new entries.
- Conservative normalization of legacy units; ambiguous `cup` / `tbsp` stay unresolved (today `QuantityService` maps them through convert-units as a single convention — stop that for saved data).
- Revised conversion and aggregation rules (mass↔mass, volume↔volume with explicit cup definitions; never cup↔grams or can↔grams without extra data).
- Unresolved / non-numeric quantities without data loss (“to taste”, original range text).
- Grocery contribution references and explicit generated vs override vs manual vs checked handling where still implicit.
- Import confirmation for ambiguous measurements (US vs metric cup, keep unspecified).

**Complete when**

- Compatible measurements aggregate correctly (g+kg, mL+L, count+count).
- Ambiguous cups and tablespoons are never guessed during migration.
- Mass and volume are not combined.
- Leftover reuse does not duplicate groceries.
- Updating a list preserves manual intent per documented policy.
- Recipe scaling does not accumulate presentation-rounding errors.
- Release gates 1–4 and 7–9 in the identity spec have coverage (introduce a test runner if needed for those scenarios).

---

## Sprint 9 — Localized ingredient matching and import quality

**Build**

- Localized preferred names and scoped aliases; legacy aliases stay unclassified until edited.
- Context-aware matching with candidate review; search across localized labels and legacy aliases.
- Stable translated keys for existing controlled categories (occasion, role, effort, reuse).
- One fully tested additional UI locale relevant to target households.
- Import review: suggest matches, highlight ambiguity, allow save with unresolved lines, ask before promoting a typed name to a reusable alias.
- Updated backup format and backward-compatible restore (Dexie version only if indexes/tables/transforms require it).

**Complete when**

- “Eggplant” and “aubergine” can find the same catalog ingredient.
- Ambiguous names do not silently resolve; fuzzy match never merges catalog records.
- User-entered names survive locale changes.
- Imports remain usable offline; household-created ingredients stay first-class without external refs.
- Locale switch still affects presentation only (gate 5–6, 10).

Ingredient merging is **not** a casual add-on. If duplicates become a real problem, a dedicated merge workflow (live refs, snapshots untouched) is a later increment.

---

## Status

Sprint 1 is done: PWA shell, Dexie persistence, navigation shell, editable household-size setting, and JSON backup export/validated restore all exist (see `SPEC.md` for the full product rules this plan implements). Not verified in this session: installing on an actual Android device, and interactive browser testing (no browser automation tool available) — see the task notes for the manual checks still needed.

Sprint 1.5 is done: `@mantine/modals`, `eslint-plugin-boundaries`, Prettier, and `@vite-pwa/assets-generator` are installed and wired in. `fraction.js` was installed in Sprint 2; `convert-units` in Sprint 4; `fuse.js` in Sprint 5; `@mantine/dropzone` and `schema-dts` in Sprint 6.

Sprint 2 is done: full recipe create/edit/detail with ingredient catalog (aliases, create-or-link), quantity scaling preview via `QuantityService`/`fraction.js`, simple foods with an enable-in-suggestions checklist, Dexie schema v2, and backup format version 2.

Sprint 3 is done: navigable seven-day plans with materialized breakfast/lunch/dinner slots, exclusions, single-item placement (recipe snapshot via cooking event, or simple food), Today/Week screens, week-start setting, Dexie schema v3, and backup format version 3.

Sprint 4 is done: standalone grocery lists generated from plans (cooking events + simple foods), `convert-units` aggregation via `QuantityService.add`/`canConvert`, common ingredients prechecked, pragmatic update-existing merge, Lists UI, Week “Generate groceries” with update/create modal, Dexie schema v4, and backup format version 4.

Sprint 5 is done: multi-component meal editor with batch reuse (core), plus remainder — auto-by-date prep sessions and effort units, meal favorites, recipe pairings, `fuse.js` Suggested/All picker, global planning preferences, and soft prompts. Dexie schema v5 and backup format version 5.

Sprint 6 is done: Schema.org Recipe import from JSON/JSON-LD paste, HTML with embedded JSON-LD, or file upload; multi-recipe selection (pick one); normalize into `RecipeEditor` draft with confirmation hints; `@mantine/dropzone` + `schema-dts`.

Checkpoint (catalog / photos / unified Plan) is done.

Sprint 7 is done: household polish + localization foundation (locale, as-entered measurement preference, formatting, copy, photo/offline rules). Sprints 8–9 deliver measurement correctness and localized ingredient matching.
