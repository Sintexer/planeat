# Feature-specific sprint plan

No dates. Keep the app releasable after every sprint. Each sprint delivers **one visible improvement**, including its UI, domain changes, persistence, backup support, and tests.

Sprints 1–6 had no automated test runner (MVP). Localization settings (`uiLocale`, `measurementPreference`) already shipped. Automated tests become in scope with the first new domain/persistence slice that needs them (Sprint 8 tags); measurement/grocery correctness remains the hard scenario gate in Sprint 13.

## Delivery approach

One developer, short sprints. The slices below are **scope boundaries**, not estimates. If a slice exceeds usual sprint capacity, split it rather than borrowing work from the next sprint.

Sequence covers recipe organization **and** the measurement/localization foundations it depends on. Commit the next two or three sprints in detail; keep the rest as this sequenced backlog so direction stays clear without pretending we already know which later refinements households will value most.

### Rules for every sprint

- Existing recipes, plans, snapshots, and grocery lists remain usable.
- Schema changes are additive where possible.
- Any new persisted data is included in backup/restore immediately.
- Core functionality works offline.
- No hidden reinterpretation of legacy data.
- New metadata is optional.
- No backend, automatic weekly generation, nutrition, or pantry inventory.
- Finish the slice before starting the next migration.

### Split rule

If a sprint requires redesigning a second subsystem to complete the first, split it at the user-visible boundary.

Examples: manual unit entry before import unit review; basic tag assignment before tag merging; filters before saved views; grocery calculation before shopping-section UI.

For each sprint, the implementation card has: one user story; at most three representative journeys; explicit non-goals; data and backup impact; acceptance tests; a short demo script.

---

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

## Checkpoint — release baseline (done)

Finish the catalog / photo / Plan work **separately** from taxonomy or measurement migrations.

**Shipped**

- Shared recipe/simple-food catalog.
- Recipe photo presentation and offline fallback.
- Unified Plan screen.
- Old route redirects (`/today`, `/week`, `/week/:planId` → `/plan`).

**Smoke test (keep using as a regression gate)**

1. Create and edit a recipe.
2. Plan a new cooking event.
3. Reuse its leftovers.
4. Generate and update groceries.
5. Export and restore a v5 backup.
6. Reload offline.

**Complete when** the application is committed, usable, and has representative migration fixtures. Do not combine this checkpoint with a taxonomy or measurement migration.

---

## Shipped — localization settings foundation

Former Sprint 7 numbering delivered household settings and presentation plumbing. **Do not reintroduce those settings.** Later slices apply or extend them:

- `uiLocale` and `measurementPreference` (default **as-entered**) on the settings row via `mergeSettingsDefaults` (not a Dexie version).
- `Intl` number formatting in UI; arithmetic stays in domain.
- `isCommon` copy: “Usually have at home” (not pantry tracking).
- URL photos optional; reliable offline placeholder; backups do not include remote image bytes.

Sprint 14 is the remaining presentation pass (consistent application to details, scaling, groceries). Sprint 12 is the unit-registry schema. Do not guess legacy cup/tablespoon conventions in the meantime.

---

# Phase 1 — A better recipe library

## Sprint 7 — Consistent browsing and navigation

**User outcome:** “I can browse my library and return to where I was.”

### Implementation card

1. **User story.** As a household cook, I browse recipes and simple foods as one library, open an item, and return to the same search, kind selection, and scroll position.

2. **Journeys**
   - Open the library, search, open a recipe, edit and save, return — list and scroll are unchanged.
   - Distinguish a recipe from a simple food on a compact card; missing time/effort is omitted rather than shown as zero or “unknown”.
   - Empty library vs no search results: each state explains what to do next. Ingredient “usually have at home” wording matches grocery precheck behavior.

3. **Non-goals.** No new filters, tags model, or database tables. No photo uploads or image backup. Reuse existing `fuse.js` search. Do not build the Sprint 10 filter drawer here. `DishCatalog` may already show extra chips (meal/role/effort/tags); leave them working if present, but do not expand or persist them as a new product surface.

4. **Data and backup impact.** None. Session restore is in-memory / router state for the library screen. Settings and backups unchanged. Photos remain URL-only.

5. **Acceptance tests**
   - Opening a recipe, editing it, and returning does not reset the library or jump unexpectedly to the top.
   - Search query and item-kind selection survive the round-trip.
   - Known `activeTimeMinutes` / `totalTimeMinutes` / effort display; absent optional times are omitted. Effort is currently required on recipes — do not invent a “missing effort” value.
   - Offline: photo placeholder still appears when a remote `photoUrl` cannot load.
   - Empty catalog and zero search hits are distinct.
   - Ingredient editor still describes `isCommon` as “Usually have at home.”

6. **Demo script.** Seeded library → filter to recipes → search “soup” → open vegetable soup → edit a note → save → back. Confirm search, kind, and scroll. Toggle airplane mode on a recipe with a photo URL and confirm the placeholder. Clear search on an empty query that matches nothing after a nonsense string.

**Current code to change (orientation):** `RecipesScreen` holds `DishCatalogFilters` in `useState` (lost on unmount). Selecting a simple food navigates to the simple-foods manager, not an item. Cards always bake effort into the recipe subtitle.

**Work chunks (implementation audit, 2026-09-16).** Already satisfied — no work needed: the shared compact card component (`DishCatalog`/`ItemRow`), the offline-safe photo placeholder (`RecipePhotoThumb`), the distinct empty-library vs. no-search-results states, and the `isCommon` "Usually have at home" copy.

1. **Persist browse state across navigation.** Move `RecipesScreen`'s `DishCatalogFilters` and scroll position out of local `useState` (`RecipesScreen.tsx:25`, reset on every mount) into something that survives the round-trip to a detail/edit screen and back, and restore scroll position on return.
2. **Give simple foods a browsable detail page.** Selecting a simple food from the library currently jumps to the whole `/recipes/simple-foods` manager (`RecipesScreen.tsx:128-133`) instead of an item — add a simple-food detail (or read-mode of the edit form) so "open and return" applies the same way it already does for recipes.
3. **Card polish.** Give item-kind (Recipe vs. Simple food) a dedicated badge/icon instead of only text baked into the subtitle; add known time to the card subtitle, following the omit-if-missing rule the detail screen already uses (`RecipeDetailScreen.tsx:184-189`).

---

## Sprint 8 — Household tags: create, assign, rename

**User outcome:** “I can organize food using my household’s own labels.”

### Implementation card

1. **User story.** As a household cook, I create my own labels, assign them while editing food, rename them later, and keep every existing assignment.

2. **Journeys**
   - In a recipe (or simple-food) editor, autocomplete an existing tag or type a new name to create-and-assign in one step.
   - Open a small tag-management screen: usage counts, rename. Renaming “batch” to “make-ahead” updates chips on cards and details immediately.
   - Export and restore: assignments survive; cooking-event snapshots still show the tag strings they stored at cook time, not a live rewrite of history.

3. **Non-goals.** Flat tags only. No archive, merge, bulk tagging, colors, saved views, or nested taxonomy. Do not automatically reclassify imported or starter tags (`batch`, `soup`, `italian`, …). Do not put live tag IDs into historical snapshots in a way that retroactively changes leftover/plan display.

4. **Data and backup impact**
   - Today `recipes.tags` and `simpleFoods.tags` are `string[]` (display labels). Introduce a `tags` catalog table with stable IDs; store assignments as tag IDs on live recipes/simple foods.
   - Additive Dexie version; migrate existing strings into tag rows (reuse one ID per distinct trimmed label, case-conservative exact-duplicate prevention on create).
   - Backup format bump: include the tag catalog and ID assignments. Restore of older backups runs the same string→ID migration.
   - Snapshots (`cookingEvents.recipeSnapshot.tags`) stay as stored historical labels — do not rewrite snapshot tag arrays when renaming a live tag.

5. **Acceptance tests**
   - Creating a tag while assigning it does not create a second row for an exact duplicate name (conservative match: trimmed, case policy documented in the service).
   - Rename updates the live library without dropping assignments.
   - Historical plan snapshots keep their original tag strings.
   - Backup export/restore round-trips the tag catalog and live assignments.
   - User errors (duplicate name on create/rename) return an error from the service, not an exception.

6. **Demo script.** Recipes → edit carbonara → add tag “Kids’ picks” (create) → save. Tag management: rename “italian” → “Italian-ish”. Library chips update. Open a past cooking event / leftover that snapshotted the old string and confirm history is unchanged. Export, restore, confirm assignments.

**Introduce a test runner here** (Vitest, Vite-native) for tag identity, rename, duplicate prevention, and backup migration. Explain the new dependency in `AGENTS.md` when adding it.

**Work chunks (implementation audit, 2026-09-16).** This sprint is almost entirely new work — today `recipes.tags`/`simpleFoods.tags` are a flat `string[]`, edited via one comma-separated `TextInput` (`RecipeEditor.tsx:275`); there is no `Tag` entity, autocomplete, or management screen anywhere in the codebase, and `SimpleFood`'s editor has no tags field at all.

1. **Tag domain + storage.** New `Tag` entity, `TagRepository`/`TagService`, additive Dexie `tags` table, migration of existing string tags into rows (one ID per distinct trimmed label, case-conservative dedupe on create), backup schema bump plus a restore-time migration for older backups.
2. **Switch live assignments to tag IDs.** Update `Recipe`/`SimpleFood` write paths to store tag IDs instead of strings. Keep `cookingEvents.recipeSnapshot.tags` as the historical label strings it already stores — never rewritten when a live tag is renamed.
3. **Editor UI.** Replace the comma-separated `TextInput` with a tag autocomplete/multi-select that can create-and-assign a new tag in one step; add the same field to the `SimpleFood` create/edit form.
4. **Tag management screen.** New screen listing tags with usage counts and rename, surfacing duplicate-name conflicts as a service-level error, not an exception.
5. **Display.** Render tag chips on `RecipeDetailScreen` (currently absent — only roles/mealTypes are shown there); confirm the existing `DishCatalog` card chips resolve IDs to current labels.
6. **Test runner.** Introduce Vitest; cover tag identity, rename, duplicate prevention, and backup migration. Record the new dependency in `AGENTS.md`.

---

## Sprint 9 — Clear recipe classification

**User outcome:** “I understand the difference between when I serve something and what kind of dish it is.”

### Implementation card

1. **User story.** As a household cook, I optionally record meal occasion, meal role, and primary dish type as separate facts, plus household tags and the existing cuisine field.

2. **Journeys**
   - Edit soup: occasions lunch **and** dinner, role main, primary dish type soup, household tag as needed — those values are not conflated on the form or on the detail screen.
   - Leave classification empty on a simple side; the recipe still saves and appears in the library.
   - A legacy/unknown role, occasion, or free-text tag remains visible and recoverable rather than dropped on save.

3. **Non-goals.** No nested taxonomy. No required classification. No automatic reclassification of existing tags (do not turn the `soup` tag into dish type soup). No new meal slots such as snacks. No cuisine-model overhaul — keep the free-text `cuisine` field.

4. **Data and backup impact**
   - Occasion already exists as `mealTypes: MealType[]` (`breakfast` / `lunch` / `dinner`). Role already exists as `roles: RecipeRole[]`. Keep those stored keys; separate **display** labels (and message keys) from stored keys.
   - Add optional **primary dish type** as a single curated key on recipes (and simple foods if the editor section is shared). Unknown legacy strings must round-trip.
   - Additive fields; backup schema allows the new optional key. Existing rows omit it.
   - Household tags stay the Sprint 8 ID model, shown in the same Organization section.

5. **Acceptance tests**
   - Soup can be lunch and dinner, role main, dish type soup, without those fields writing into each other.
   - Empty organization fields are valid.
   - Unknown legacy values survive edit/save and backup restore.
   - Controlled lists use stable keys; UI shows localized labels.

6. **Demo script.** Edit vegetable soup → Organization: Lunch + Dinner, Main, dish type Soup, keep tag “vegetable”. Save. Detail shows four distinct facts. Create a new recipe with no organization filled — it lists. Restore a pre-sprint backup; old `mealTypes` / `roles` / string tags still load.

**Work chunks (implementation audit, 2026-09-16).** Meal occasion (`mealTypes`), meal role (`roles`), and the free-text `cuisine` field already exist with the stored-key/display-label separation this sprint asks for (`MealEnums.ts`) — reuse, don't rebuild, those.

1. **Primary dish type.** New curated enum + label map alongside `MealEnums.ts`; optional field on `Recipe` (and `SimpleFood` if the section is shared); additive persistence; unknown/legacy-value passthrough on save.
2. **Organization section.** `RecipeEditor.tsx` has no field grouping today — meal occasion, role, cuisine, and tags sit scattered in one flat `Stack` (`RecipeEditor.tsx:191-357`). Add a visually distinct Organization section (reusing the `<Title order={4}>` section-header pattern already used on `RecipeDetailScreen.tsx`) containing meal occasion, role, dish type, tags (Sprint 8), and cuisine.
3. **Detail-screen display.** Show the four facts (occasion, role, dish type, tags) as separate, non-conflated badges/rows on `RecipeDetailScreen`.

---

## Sprint 10 — Basic library filtering

**User outcome:** “I can narrow the library to a useful set of choices.”

**Deliver.** A mobile filter drawer: item kind, meal occasion, meal role, household tags. Staged changes with a **Show N items** action. Applied filter chips. Clear filters, separate from clear search. Helpful no-match state. OR within a facet, AND between facets.

**Boundaries.** No ingredient, time, dietary, or reuse filters yet. No saved views. No advanced boolean query builder. Do not add catalog favorites solely to populate this drawer.

**Done when.** “Lunch or dinner” plus “Kids’ picks” produces predictable results, and removing one filter does not reset the others.

**Work chunks (implementation audit, 2026-09-16).** Cross-facet AND matching (`itemMatchesFilters`, `catalogModel.ts:117-128`) and a distinct no-match empty state already exist — extend, don't reintroduce, those.

1. **Multi-select facets.** Convert `DishCatalogFilters`' single-value facets (`mealType`, `role`, `tag`) to sets, and update `itemMatchesFilters` for OR-within-facet / AND-between-facet combination.
2. **Filter drawer with staged apply.** A Mantine `Drawer` (none exists in the app today) replacing the inline collapsible chip panel for mobile, holding a draft filter state with a "Show N items" commit action instead of today's apply-on-every-toggle behavior.
3. **Applied-filter chips, Clear actions, and no-match polish.** A removable chip per active filter, a "Clear filters" action distinct from clearing the search text (neither exists today — only a filter-count badge on the toggle button), and a "Clear filters" call-to-action inline in the existing generic no-match message.
4. **Household-tag facet.** Swap the free-text tag matching for the Sprint 8 tag-ID model once it ships; blocked on Sprint 8, sequence accordingly.

---

## Sprint 11 — Sorting and simple grouping

**User outcome:** “I can scan the library in an order that makes sense to me.”

**Deliver.** Sort: name, recently added, recently edited, shortest recorded total time, relevance while searching. Group: none, item kind, primary dish type. Persist the preferred sort/group choice.

**Boundaries.** One grouping level. No grouping by multi-valued tags or cuisine. No “recently cooked” sort based on planning history.

**Done when.** Each item appears once, unclassified items remain visible, and missing time values sort last.

**Work chunks (implementation audit, 2026-09-16).** Fuse.js already orders search results by relevance (`DishCatalog.tsx:216-220`) and `groupCatalogItems` already guarantees each item appears once — reuse both instead of rebuilding. `rankComponentSuggestions` (`componentSuggestions.ts`) is a separate, already-cleanly-isolated planning-history ranking system — keep it that way; a new date-based sort must not fold in its scoring.

1. **Expose timestamps to the catalog layer.** `DishCatalogItem` doesn't carry `createdAt`/`updatedAt` today; add them in `recipeToCatalogItem`/`simpleFoodToCatalogItem` so a date-based sort has something to sort on.
2. **Sort control.** New sort control + comparators: name, recently added, recently edited, shortest total time (missing-last), relevance-while-searching (reuse the existing Fuse ordering as the default while a query is active).
3. **Group control.** Rework `groupCatalogItems` to support a user-selectable mode (none / item kind / primary dish type — the last depends on Sprint 9), while preserving the existing Suggested-first behavior used by the meal picker (`AddComponentFlow`) as a distinct context from the plain library screen.
4. **Persist the preference.** Add sort/group fields to the `Settings` entity (`Settings.ts`) via the existing additive-merge pattern (`mergeSettingsDefaults`) — there is no `localStorage` precedent in this app, so keep using Settings/Dexie.

### Release checkpoint A

PlanEat has a substantially better recipe box. Release and observe whether households actually use the classifications before expanding them.

---

# Phase 2 — Trustworthy measurements and localization

## Sprint 12 — Explicit units in manual recipe entry

**User outcome:** “When I enter a measurement, the app knows what I mean.”

**Deliver.** Small bundled unit registry. Explicit choices for ambiguous physical units (US vs metric cups). Separate mass ounces and fluid ounces. Preserve entered measurement text. Unspecified/legacy unit support. Valid non-numeric lines such as “salt to taste.” Update the **manual** recipe editor and detail display only.

**Boundaries.** Do not guess legacy cup or tablespoon conventions. No ingredient-density conversions. No can-to-grams or clove-to-bulb assumptions. Do not rebuild import review in this sprint.

**Done when.** New entries can be unambiguous, while old entries still display and round-trip through backup without invented meanings.

**Note.** Today `QuantityService` aliases `cup` → convert-units `cup` and `tbsp` → `Tbs`. Stop treating those as one convention for **new** saved data. Leave grocery aggregation on the current path until Sprint 13.

---

## Sprint 13 — Safe scaling and grocery aggregation

**User outcome:** “Scaled quantities and grocery totals do not combine incompatible measurements.”

**Deliver.** Use the explicit unit model for recipe quantity scaling, compatible mass/volume aggregation, separate display of incompatible quantities, and preservation of unresolved measurements. Verify existing manual grocery-edit behavior against the revised aggregation.

**Boundaries.** No new grocery grouping UI. No ingredient-density database. If grocery override handling requires a redesign, make that its own slice.

**Done when**

- `500 g + 1 kg → 1.5 kg`.
- `200 g flour + 1 cup flour` remains separate.
- An unspecified cup stays unspecified.
- Leftover reuse does not count the same cooking event twice.
- Updating a list preserves manual items and follows the existing explicit override policy.

This is the household-scenario test gate for measurements.

---

## Sprint 14 — Measurement and formatting preferences

**User outcome:** “Measurements are displayed in a familiar format without changing the recipe.”

**Deliver.** Separate household settings for regional number formatting and measurement display preference: as entered, metric, US customary. Apply them consistently to recipe details, scaling controls, and generated grocery quantities. Use `Intl` where supported and localized messages for culinary units.

**Already shipped (do not redo):** `uiLocale`, `measurementPreference` defaults, and basic `Intl` wiring. This sprint is the consistency pass and culinary-unit messages.

**Boundaries.** Regional formatting, not a fully translated UI. Convert only known compatible physical units. Do not rewrite stored recipe quantities. Default existing households to as entered.

**Done when.** Switching preferences changes presentation but not recipe meaning, local dates, plan snapshots, or stored quantities.

---

## Sprint 15 — Localized ingredient names and safer alias lookup

**User outcome:** “Different names for an ingredient are searchable without becoming different ingredients.”

**Deliver.** Preferred ingredient labels scoped by locale. Existing default name as fallback. Locale-scoped and legacy/unclassified aliases. Ingredient editing for those labels. Catalog search across names and aliases. Candidate selection when an alias is ambiguous.

**Boundaries.** No external ingredient database. No automatic ingredient merging. No automatic translation of household content. No import-flow redesign yet.

**Done when.** “Eggplant” and “aubergine” can find one ingredient, while an ambiguous term can produce multiple candidates rather than silently selecting one.

---

## Sprint 16 — Measurement review during import

**User outcome:** “Imported measurements are useful even when the source is unclear.”

**Deliver.** Extend the existing import draft: known-unit recognition, visible unresolved measurements, explicit confirmation for ambiguous cups and tablespoons, preservation of the original ingredient line, ability to save without resolving everything. Reuse the Sprint 12 unit selector.

**Boundaries.** Unit review only. No new parser provider. No live URL fetching. No ingredient-match overhaul in this sprint.

**Done when.** An imported “2 cups flour” can be confirmed as a specific convention or retained as unspecified without losing the original text.

---

## Sprint 17 — Ingredient matching during import

**User outcome:** “Imported ingredients connect to my catalog without polluting it.”

**Deliver.** Suggested matches using names and aliases. Explicit candidate selection for ambiguous matches. Create an ingredient from the draft. Save an unresolved line without blocking the recipe. Separate confirmation before adding an imported phrase as a reusable alias.

**Boundaries.** No automatic ingredient merge. No automatic persistent tags from imported keywords. No dietary-safety inference.

**Done when.** A mistaken import match can be corrected without changing the meaning of existing recipes or teaching the catalog an unwanted alias.

### Release checkpoint B

Safer mixed-source recipes and measurements. Test with real household imports before adding more parsing intelligence.

---

# Phase 3 — Better decisions while planning and shopping

## Sprint 18 — Practical advanced filters

**User outcome:** “I can find recipes that fit my time and ingredient needs.”

**Deliver.** Extend the existing filter drawer: maximum recorded total time, effort, contains ingredient, exclude ingredient. Use ingredient IDs; alias lookup only to help select the ingredient.

**Boundaries.** No dietary certification filters. No density or nutrition calculations. No reuse/freezer filter unless existing structured data supports it reliably.

**Done when.** Missing total time is not treated as zero. Ingredient filters are distinct from broad text search. Exclusion is described as filtering recorded ingredients—not an allergy-safety guarantee. Unresolved ingredient data is handled visibly rather than presented as certainty.

---

## Sprint 19 — Contextual meal-picker organization

**User outcome:** “Adding food to a meal is easier than browsing the whole library.”

**Deliver.** Reorganize existing capabilities into sections: available leftovers, suitable recipes, existing pairings, all items, existing favorite meals. Reuse library search and relevant filters, but **separate picker state**. Short explanations: “Uses Monday’s batch.” / “Often paired with rice.” / “Already planned this week.”

**Boundaries.** Reuse existing suggestion logic. No new recommendation engine. No automatic weekly generation. No silent occasion filter on All items.

**Done when.** “Cook this recipe” and “Use this previous batch” are unmistakably different actions, and library filters do not unexpectedly restrict the picker.

---

## Sprint 20 — Grocery shopping sections

**User outcome:** “The list is organized for shopping, not just recipe calculation.”

**Deliver.** Optional shopping section on catalog ingredients. Small localized starter list of sections. Grouped and flat grocery views. Section selection for manual grocery lines. Hide-checked toggle. Stable row behavior while checking items. Suggested sections: produce, bakery, chilled, pantry, frozen, other.

**Boundaries.** No store-specific aisle maps. No pantry tracking. No automatic universal categorization. No grouping by recipe that duplicates aggregated quantities.

**Done when.** Items without a section remain visible under Other, manual lines are preserved, and checking an item does not unexpectedly move nearby tap targets.

### Release checkpoint C

Core improvement program complete: better discovery, safer measurements, clearer meal selection, and a more usable shopping list.

---

# Phase 4 — Optional follow-up slices

Prioritize from household feedback. Do not automatically commit these after Sprint 20.

## Sprint 21 — Tag lifecycle management

**User outcome:** “I can clean up my organization without losing recipes.”

**Deliver.** Archive tags. Merge one tag into another. Delete with affected-item counts and confirmation. Deduplicate live assignments during merge. Preserve historical snapshot labels.

**Exclude.** Bulk tagging, nested tags, automated rules.

**Done when.** Every operation has clear consequences, completes transactionally, and never deletes food items.

---

## Sprint 22 — Saved library views

**User outcome:** “I can return to my useful combinations of filters.”

**Deliver.** Save the current query, filters, sort, and grouping. Rename and delete a saved view. Show unsaved modifications. Explicit Update view versus Save as new. Handling for deleted or archived filter references.

**Exclude.** Sharing, recommended views, and automation.

**Done when.** New matching recipes appear automatically, and changing filters never silently overwrites a saved view.

---

# Work intentionally not squeezed into this sequence

These need their own bounded backlog if demand appears:

| Feature                                       | Why deferred                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Full second-language UI                       | Requires translation inventory and screen-by-screen review; number formatting is not full localization. |
| Catalog recipe/food favorites                 | Useful, but separate from existing favorite meals; add if tags and views are insufficient.              |
| Bulk tagging                                  | Valuable mainly once catalogs become large.                                                             |
| Cuisine normalization                         | Preserve current data until duplicates and filtering needs justify a migration.                         |
| Dietary suitability system                    | Needs explicit provenance and uncertainty rules.                                                        |
| Local photo uploads and portable image backup | Separate storage, quota, and backup concerns.                                                           |
| Custom grocery aisle order                    | Useful after basic shopping sections are validated.                                                     |
| External ingredient enrichment                | No current requirement justifies the dependency.                                                        |

---

## Status

Sprint 1 is done: PWA shell, Dexie persistence, navigation shell, editable household-size setting, and JSON backup export/validated restore all exist (see `SPEC.md` for the full product rules this plan implements).

Sprint 1.5 is done: `@mantine/modals`, `eslint-plugin-boundaries`, Prettier, and `@vite-pwa/assets-generator` are installed and wired in. `fraction.js` was installed in Sprint 2; `convert-units` in Sprint 4; `fuse.js` in Sprint 5; `@mantine/dropzone` and `schema-dts` in Sprint 6.

Sprint 2 is done: full recipe create/edit/detail with ingredient catalog (aliases, create-or-link), quantity scaling preview via `QuantityService`/`fraction.js`, simple foods with an enable-in-suggestions checklist, Dexie schema v2, and backup format version 2.

Sprint 3 is done: navigable seven-day plans with materialized breakfast/lunch/dinner slots, exclusions, single-item placement (recipe snapshot via cooking event, or simple food), Today/Week screens later unified on Plan, Dexie schema v3, and backup format version 3.

Sprint 4 is done: standalone grocery lists generated from plans (cooking events + simple foods), `convert-units` aggregation via `QuantityService.add`/`canConvert`, common ingredients prechecked, pragmatic update-existing merge, Lists UI, Week “Generate groceries” with update/create modal, Dexie schema v4, and backup format version 4.

Sprint 5 is done: multi-component meal editor with batch reuse (core), plus remainder — auto-by-date prep sessions and effort units, meal favorites, recipe pairings, `fuse.js` Suggested/All picker, global planning preferences, and soft prompts. Dexie schema v5 and backup format version 5.

Sprint 6 is done: Schema.org Recipe import from JSON/JSON-LD paste, HTML with embedded JSON-LD, or file upload; multi-recipe selection (pick one); normalize into `RecipeEditor` draft with confirmation hints; `@mantine/dropzone` + `schema-dts`.

Checkpoint (catalog / photos / unified Plan) is done.

Localization settings foundation is done (`uiLocale`, `measurementPreference`, formatting, “usually at home” copy, photo/offline rules).

Sprint 7 is done: browse-state (search/filters/scroll) persists across a round-trip to a recipe or simple-food detail screen, a dedicated simple-food detail page (inline-editable), and catalog cards show a kind badge plus known recipe time.

Sprint 8 is done: `Tag` domain entity with stable IDs (`src/domain/tags/Tag.ts`), `TagRepository`/`TagService`/`DexieTagRepository` mirroring the ingredient pattern, Dexie schema v6 migrating existing `recipes`/`simpleFoods` string tags into linked `tagIds`, backup format version 6 with a separate frozen-label `recipeSnapshot` schema, `TagsInput`-based autocomplete-or-create assignment in the recipe editor and simple-food detail screen, a `/recipes/tags` management screen (rename + usage counts), and the first Vitest test runner (`bun run test`) covering tag identity/rename/dedupe and backup version handling via in-memory repository test doubles.

Sprint 9 is done: curated but lenient `dishType?: string` on `Recipe` (`DISH_TYPES`/`DISH_TYPE_LABELS` in `MealEnums.ts` drive the editor's `Select`, but storage/backup stay a plain optional string so an unrecognized value always round-trips), a visually distinct "Organization" section in `RecipeEditor`/`RecipeDetailScreen` grouping occasion, role, dish type, cuisine, and tags, and cuisine shown on the detail screen for the first time. No Dexie migration or backup-version bump — purely additive optional field.

Sprint 10 is done: `DishCatalogFilters`' `mealType`/`role`/`tag` facets became multi-select arrays (`mealTypes`/`roles`/`tagIds`) with OR-within/AND-across-facet matching in `itemMatchesFilters`; tag filtering moved from display-name string comparison to the Sprint 8 tag-ID model (`DishCatalogItem.tagIds`, `uniqueTagFacets`); a new `FilterDrawer` (Mantine `Drawer`, bottom sheet, staged draft state with a "Show N items" commit action) replaced the inline apply-on-toggle chip panel in `DishCatalog`; an applied-filter-chip row (one removable chip per active value) plus a "Clear filters" action (separate from the search box) were added; and the no-match state gained a filter-aware message with an inline "Clear filters" CTA when facets (not just search text) produced zero results.

Sprint 11 is done: `DishCatalogItem` gained `createdAt`/`updatedAt`/`dishType` (sourced from `Recipe`/`SimpleFood`); a new `sortCatalogItems` pure function supports name / recently-added / recently-edited / shortest-recorded-time (missing-last) / relevance (pass-through) sorting; `groupCatalogItems` was reworked to take `{ searching, suggestedFirst?, mode? }`, preserving `AddComponentFlow`'s exact Suggested-first behavior while giving `RecipesScreen` a user-selectable none/item-kind/primary-dish-type grouping with an always-last "Unclassified" bucket; two new `Select` controls were added to `DishCatalog`; and the choice persists via new `Settings.catalogSort`/`catalogGroup` fields (additive, no Dexie version bump, `backupSchema.ts` updated, `mergeSettingsDefaults`/`DexieSettingsRepository` backfill existing rows) written immediately through the existing `SettingsRepository.update`.

Sprint 12 is done: a new `src/domain/shared/UnitRegistry.ts` (flat, non-nested `UnitDefinition[]`) adds explicit `cup-us`/`cup-metric`/`oz-mass`/`oz-fl` entry-time units alongside `cup`/`tbsp` kept as recognized-but-`legacy` keys — decoupled from `Quantity.unit` (still a plain string everywhere) and from `QUANTITY_UNITS`/`isQuantityUnit` (left untouched, since import review still depends on them); `RecipeIngredientLine.quantityText?: string` gives ingredient lines a first-class non-numeric amount ("to taste"), additive in `backupSchema.ts` with no Dexie or backup-format version bump; the manual recipe editor gained a per-line Amount/Describe-amount `SegmentedControl`, and `QuantityFields`' unit `Select` no longer silently coerces an unrecognized/legacy stored unit to `'piece'` (fixed via a new `unitOptionsFor` helper); `RecipeDetailScreen` renders `quantityText` directly when present. `QuantityService`/grocery aggregation were not touched, per the sprint's own boundary — new-convention units simply don't aggregate with anything yet, deferred to Sprint 13.

Sprint 13 is done: `QuantityService`'s unit resolution now derives from `UnitRegistry` instead of a separate hardcoded alias table, so `oz-mass`/`oz-fl`/`cup-us` correctly aggregate with `g`/`kg`/`ml`/`l` as intended. This is also a deliberate behavior change: a bare legacy `cup`/`tbsp` no longer silently cross-converts with other volume units (it previously assumed the US customary convention) — it now only matches another exact-string `cup`/`tbsp`, satisfying "an unspecified cup stays unspecified." `cup-metric` remains resolvable only against itself, since `convert-units@2.3.4` has no metric-cup code and no custom-unit registration API — a documented, intentional limitation, not a redesign. Leftover-reuse dedup (`buildRequirementLines`'s cooking-event `Set`) and manual-item preservation (`updateFromPlan`/`deleteGeneratedItems` only touching `origin: 'generated'` rows) were already correct and needed no code change — this sprint's main deliverable is the first real test coverage for measurements: `QuantityService.test.ts` and `GroceryService.test.ts` (in-memory fake repositories), covering every Done-when scenario end-to-end.

Sprint 14 is done: `QuantityService.presentForDisplay(quantity, preference)` converts a quantity into the canonical unit for the household's measurement preference (mass → `g`/`oz-mass`, volume → `ml`/`oz-fl`) via the same legacy-aware `UnitRegistry`/convert-units resolution aggregation already uses, then hands off to `presentQuantity` (still pure domain code) for same-family magnitude selection — extended with an `oz-fl`↔`cup-us` threshold alongside its existing g↔kg/ml↔l logic. Legacy `cup`/`tbsp`, `cup-metric`, `piece`/`serving`, and unrecognized units always pass through unconverted under every preference. `UnitRegistry.ts` gained a `shortLabel`/`unitShortLabel` for display (e.g. "fl oz" instead of the raw `oz-fl` key), consumed by `formatQuantityDisplay`; `useFormatQuantity` now closes over `quantityService.presentForDisplay` via `useServices()`, so all ~10 existing screens that already call the shared formatter picked up the fix with zero per-screen changes. `RecipeDetailScreen`'s scale-factor readout now uses `Intl.NumberFormat` instead of manual `toFixed`. New `presentQuantity.test.ts` and an extended `QuantityService.test.ts` cover both preferences' conversions and the legacy/unresolvable-unit pass-through guarantee.

**Next:** Sprint 15 (localized ingredient names and safer alias lookup). Sprints 16–22 remain sequenced backlog.
