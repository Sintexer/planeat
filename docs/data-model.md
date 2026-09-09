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
| `cookingEvents`  | `id`        | `planId`                           | Recipe snapshot + output quantity; `sessionId` always `null` for now          |

Schema changes must be added as new `.version(n)` blocks in `src/infrastructure/db/migrations/index.ts` — never edit a shipped version, so existing local data survives upgrades.

Backup file format is independent: `CURRENT_BACKUP_FORMAT_VERSION` is **3** and includes `recipes`, `settings`, `ingredients`, `simpleFoods`, `plans`, `mealSlots`, `mealComponents`, and `cookingEvents`.

Grocery lists are modeled in version 4. Prep sessions / favorites / pairings are not yet modeled — add them here as they're implemented.

## Version 4

Standalone grocery lists generated from plans (pragmatic update keeps manual items and matching checkmarks).

| Table          | Primary key | Indexes                  | Notes                                                                |
| -------------- | ----------- | ------------------------ | -------------------------------------------------------------------- |
| `groceryLists` | `id`        | `status`, `sourcePlanId` | `open` / `closed`; optional `sourcePlanId` + `sourcePlanRevision`    |
| `groceryItems` | `id`        | `listId`                 | Generated or manual; `checked`; optional `ingredientId` + `quantity` |

Backup format version **4** adds `groceryLists` and `groceryItems`.

Prep sessions, meal favorites, and recipe pairings are not yet modeled — add them here as they're implemented. Schema stays at **v4** for the Sprint 5 core batch-reuse vertical (shared cooking events need no new tables).

## Starter library

When `recipes` is empty at app bootstrap, `seedStarterLibraryIfEmpty` inserts a fixed catalog of ingredients, recipes, and simple foods (`src/infrastructure/db/seed/`). Rows use stable `seed-*` ids and are ordinary editable library data. If any recipe already exists, seeding is skipped.
