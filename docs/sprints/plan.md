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
- Recipe quantities can be scaled.
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
- Ingredient scaling and compatible-unit aggregation.
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
- Pairing suggestions.
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
- JSON/JSON-LD paste and file import.
- Schema.org `Recipe` extraction.
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
