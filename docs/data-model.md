# Data model

IndexedDB via Dexie (`src/infrastructure/db/database.ts`), database name `planeat`.

## Version 1

| Table      | Primary key | Indexes | Notes                                                                |
| ---------- | ----------- | ------- | -------------------------------------------------------------------- |
| `recipes`  | `id`        | `name`  | See `src/domain/recipes/Recipe.ts`                                   |
| `settings` | `id`        | —       | Single row, id `"app-settings"`; see `src/domain/shared/Settings.ts` |

Schema changes must be added as new `.version(n)` blocks in `src/infrastructure/db/migrations/index.ts` — never edit a shipped version, so existing local data survives upgrades.

Planning, groceries, and other domain tables are not yet modeled — add them here as they're implemented.
