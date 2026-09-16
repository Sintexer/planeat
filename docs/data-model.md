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

Backup file format is independent: `CURRENT_BACKUP_FORMAT_VERSION` is **5** (see v5 below). Historical notes: version **3** first included plans/slots/components/cooking events; version **4** added grocery tables.

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

Backup format version **5** adds `prepSessions`, `mealFavorites`, `recipePairings` and requires string `sessionId` on cooking events. Export a representative v5 backup before the first measurement migration (Sprint 12).

## Planned — upcoming sprints (not shipped)

Do not invent locale on existing aliases. Additive fields first; leave ambiguous units unresolved. See [`docs/sprints/plan.md`](sprints/plan.md).

| Concept                   | Direction                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Tags (Sprint 8)           | Catalog with stable IDs; live recipe/simple-food assignments by ID; snapshots keep historical label strings                     |
| Classification (Sprint 9) | Optional primary dish type key; keep existing `mealTypes` / `roles`; unknown legacy values recoverable                          |
| Settings                  | `uiLocale`, `measurementPreference` (`as-entered` default) already shipped; optional `defaultRecipeMeasurementConvention` later |
| Ingredients               | Keep IDs; names/aliases become locale-scoped metadata (Sprint 15); optional `externalRefs` later                                |
| Recipe lines              | Keep `displayText` / original text; optional `unitId`, `enteredUnit`, `enteredName`, `preparation`; `ingredientId` may be unset |
| Units (12–13)             | Bundled registry (`cup_us_customary` vs `cup_metric`, `tbsp_australian` = 20 mL, …) — not a Dexie table of household units      |
| Grocery items             | Keep origin/override/checked; optionally compact cooking-event contribution refs; shopping section later (Sprint 20)            |
| Snapshots                 | Self-contained; never reinterpret units from current settings; never regenerate from the live library recipe                    |

## Starter library

When `recipes` is empty at app bootstrap, `seedStarterLibraryIfEmpty` inserts a fixed catalog of ingredients, recipes, and simple foods (`src/infrastructure/db/seed/`). Rows use stable `seed-*` ids and are ordinary editable library data. If any recipe already exists, seeding is skipped.
