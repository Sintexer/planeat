# Feature-specific sprint plan

No dates and no automated test work. Each sprint ends with a usable increment and concrete completion criteria.

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
- Dependency decisions for later sprints recorded (not installed yet): `fraction.js`, `convert-units`, `fuse.js`, `@mantine/dropzone`, `schema-dts`.

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

## Sprint 7 — Household-use polish

**Build**

- Faster recipe/component selection.
- Better mobile quantity editing.
- Empty states and validation messages.
- Clear distinction between excluded and unplanned meals.
- Grocery-update preview refinements.
- Settings organization.
- Offline/update status feedback.
- Small starter guidance, without forcing a bundled recipe library.

**Complete when**

- The entire workflow is comfortable on your Android phone.
- You can build a plan, reuse batches, generate groceries, shop, and close the list without developer tools.
- Errors explain what to fix instead of leaving invalid dependencies hidden.

---

## Status

Sprint 1 is done: PWA shell, Dexie persistence, navigation shell, editable household-size setting, and JSON backup export/validated restore all exist (see `SPEC.md` for the full product rules this plan implements). Not verified in this session: installing on an actual Android device, and interactive browser testing (no browser automation tool available) — see the task notes for the manual checks still needed.

Sprint 1.5 is done: `@mantine/modals`, `eslint-plugin-boundaries`, Prettier, and `@vite-pwa/assets-generator` are installed and wired in; `convert-units`, `fuse.js`, `@mantine/dropzone`, and `schema-dts` are recorded as future-sprint dependencies but intentionally not installed yet. `fraction.js` was installed in Sprint 2.

Sprint 2 is done: full recipe create/edit/detail with ingredient catalog (aliases, create-or-link), quantity scaling preview via `QuantityService`/`fraction.js`, simple foods with an enable-in-suggestions checklist, Dexie schema v2, and backup format version 2.
