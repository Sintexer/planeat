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

Schema changes must be added as new `.version(n)` blocks in `src/infrastructure/db/migrations/index.ts` — never edit a shipped version, so existing local data survives upgrades.

Backup file format is independent: `CURRENT_BACKUP_FORMAT_VERSION` is **2** and includes `recipes`, `settings`, `ingredients`, and `simpleFoods`.

Planning, groceries, and other domain tables are not yet modeled — add them here as they're implemented.
