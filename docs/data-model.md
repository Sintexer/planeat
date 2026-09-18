# Data model

IndexedDB via Dexie (`src/infrastructure/db/database.ts`), database name `planeat`.

## Version 1

| Table      | Primary key | Indexes | Notes                                                                   |
| ---------- | ----------- | ------- | ----------------------------------------------------------------------- |
| `recipes`  | `id`        | `name`  | Minimal `{ id, name, servings, createdAt, updatedAt }` smoke-test shape |
| `settings` | `id`        | —       | Single row, id `"app-settings"`; see `src/domain/shared/Settings.ts`    |

## Version 2

Additive stores; existing recipe rows are upgraded in place (`servings` → `yield` + defaults).

| Table         | Primary key | Indexes                | Notes                                                                  |
| ------------- | ----------- | ---------------------- | ---------------------------------------------------------------------- |
| `recipes`     | `id`        | `name`                 | Full recipe document — see `src/domain/recipes/Recipe.ts`              |
| `settings`    | `id`        | —                      | Unchanged                                                              |
| `ingredients` | `id`        | `name`                 | Canonical name, aliases, category, `isCommon`                          |
| `simpleFoods` | `id`        | `name`, `ingredientId` | Links an ingredient; default portion; `enabledInSuggestions` checklist |

## Version 3

Adds weekly planning tables; settings rows gain `weekStartDay` (default Monday = `1`).

| Table            | Primary key | Indexes                            | Notes                                                                         |
| ---------------- | ----------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `plans`          | `id`        | `startDate`                        | Seven-day plan; `peopleCount`, `revision`, empty `preferences`                |
| `mealSlots`      | `id`        | `planId`, `[planId+date+mealType]` | One row per day × breakfast/lunch/dinner; `excluded` flag                     |
| `mealComponents` | `id`        | `slotId`                           | Source is cooking-event or simple-food; allocated quantity; multiple per slot |
| `cookingEvents`  | `id`        | `planId`                           | Recipe snapshot + output quantity; `sessionId` filled in v5 migration         |

Schema changes must be added as new `.version(n)` blocks in `src/infrastructure/db/migrations/index.ts` — never edit a shipped version, so existing local data survives upgrades.

**Dexie schema version and backup format version are separate contracts.** A model change needs a Dexie bump only when indexes, tables, or stored-row transforms require it. Backup format versions are bumped when the export/restore payload shape changes. Use the same upgrade logic for legacy backup restores where practical; validate the full upgraded backup before replacing local data.

Backup file format is independent: `CURRENT_BACKUP_FORMAT_VERSION` is **7**. Historical notes: version **3** first included plans/slots/components/cooking events; version **4** added grocery tables; version **5** added prep sessions, favorites, and pairings; version **6** added tags.

## Version 4

Standalone grocery lists generated from plans (pragmatic update keeps manual items and matching checkmarks).

| Table          | Primary key | Indexes                  | Notes                                                                                                |
| -------------- | ----------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `groceryLists` | `id`        | `status`, `sourcePlanId` | `open` / `closed`; optional `sourcePlanId` + `sourcePlanRevision`                                    |
| `groceryItems` | `id`        | `listId`                 | `origin` generated/manual; `quantityManuallyEdited`; `checked`; optional `ingredientId` + `quantity` |

Backup format version **4** adds `groceryLists` and `groceryItems`.

## Version 5

Sprint 5 remainder: auto prep sessions, favorites, pairings, planning preference settings.

| Table            | Primary key | Indexes                   | Notes                                                                |
| ---------------- | ----------- | ------------------------- | -------------------------------------------------------------------- |
| `prepSessions`   | `id`        | `planId`, `[planId+date]` | Auto one session per plan date; optional unused `time` / `label`     |
| `mealFavorites`  | `id`        | `name`                    | Named component templates (recipe/simple-food refs + quantities)     |
| `recipePairings` | `id`        | `recipeId`                | Explicit `pairs-with` links to recipe or simple-food                 |
| `cookingEvents`  | `id`        | `planId`, `sessionId`     | `sessionId` is a real prep-session id after migration                |
| `settings`       | `id`        | —                         | Adds max batch-prep units, preferred/quick days, veg/demanding prefs |

`uiLocale` and `measurementPreference` are merged onto the same settings row via `mergeSettingsDefaults`; not a Dexie version.

Backup format version **5** adds `prepSessions`, `mealFavorites`, `recipePairings` and requires string `sessionId` on cooking events.

## Version 6

Household tags (Sprint 8). Live recipes and simple foods store `tagIds`; cooking-event snapshots keep frozen historical label strings.

| Table         | Primary key | Indexes   | Notes                                                         |
| ------------- | ----------- | --------- | ------------------------------------------------------------- |
| `tags`        | `id`        | `name`    | Catalog; rename/archive/merge/delete do not rewrite snapshots |
| `recipes`     | `id`        | unchanged | `tags: string[]` migrated to `tagIds`                         |
| `simpleFoods` | `id`        | unchanged | same `tagIds` migration                                       |

Backup format version **6** includes the tag catalog, live `tagIds`, and a separate snapshot schema that still uses stored labels.

Later additive fields (no Dexie bump): `dishType`, `catalogSort`/`catalogGroup`, `UnitRegistry` keys on quantities as plain strings, `quantityText` / `sourceText` on lines, optional `ingredientId`, ingredient `preferredLabels`/`localizedAliases`, optional `shoppingSection` on ingredients and grocery items, optional `archived` on tags.

## Version 7

Saved library views (Sprint 22). Each row is a named snapshot of Recipes browse criteria (query, filters, sort, grouping). Restoring a view applies those criteria to the live catalog.

| Table          | Primary key | Indexes | Notes                           |
| -------------- | ----------- | ------- | ------------------------------- |
| `libraryViews` | `id`        | `name`  | Named views; update is explicit |

Backup format version **7** adds `libraryViews`.

## Shipped model rules (keep)

- Ingredient identity is the ID. Do not invent a locale on existing `aliases`.
- `ingredientId` on a recipe line may be unset (unlinked import).
- Units live in `UnitRegistry` (`cup-us`, `cup-metric`, `oz-mass`, `oz-fl`; legacy `cup`/`tbsp` stay self-only). Not a Dexie table of household units.
- Snapshots stay self-contained: never reinterpret units from current settings; never regenerate from the live library recipe.
- Settings presentation fields (`uiLocale`, `measurementPreference`, catalog sort/group) merge via `mergeSettingsDefaults`.

## Still planned (not shipped)

See [`docs/sprints/plan.md`](sprints/plan.md). Core sprints through 22 are shipped. Optional later: `externalRefs` on ingredients, `defaultRecipeMeasurementConvention`.

## Starter library

When `recipes` is empty at app bootstrap, `seedStarterLibraryIfEmpty` inserts a fixed catalog of ingredients, recipes, and simple foods (`src/infrastructure/db/seed/`). Rows use stable `seed-*` ids and are ordinary editable library data. If any recipe already exists, seeding is skipped.
