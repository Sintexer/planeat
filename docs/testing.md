# Testing & Quality Assurance

## Scope

Vitest covers **domain and application unit tests only** — pure functions and services in `src/domain/**` and `src/application/**`, exercised via in-memory repository test doubles. There is no DOM/UI test layer (no React Testing Library, no browser/jsdom environment) and no Dexie/IndexedDB polyfill: `vitest.config.ts` sets `environment: 'node'`, so any test touching real Dexie or rendering a component is out of scope by design.

`bun run typecheck`, `bun run lint`, `bun run build`, and manual/browser verification are the gate for everything Vitest doesn't cover (UI screens, PWA behavior, Dexie migrations against real IndexedDB). See [AGENTS.md](../AGENTS.md) for the full command list and the "run before reporting a task complete" rule.

## Tooling

- **Test runner**: [Vitest](https://vitest.dev) (`bun run test` → `vitest run`).
- **Environment**: `node` (`vitest.config.ts`) — no DOM globals available.
- **Linting/formatting**: ESLint (`bun run lint`, includes `eslint-plugin-boundaries`) and Prettier (`bun run format` / `format:check`); style is not a separate lint concern.

## Commands

| Command                       | Description                                                                |
| ----------------------------- | -------------------------------------------------------------------------- |
| `bun run test`                | Run the full Vitest suite once                                             |
| `bunx vitest run <path>`      | Run a single test file, e.g. `bunx vitest run src/domain/tags/Tag.test.ts` |
| `bunx vitest run -t "<name>"` | Run tests whose name matches a pattern, across all files                   |
| `bunx vitest`                 | Watch mode, for iterating on one file                                      |

## Conventions

- **In-memory repository test doubles**, not a Dexie/IndexedDB polyfill. Each application-service test file defines a small `Fake<X>Repository implements <X>Repository` backed by a `Map`, implementing only what the service under test actually calls (unused port methods throw `new Error('not implemented')`). See `src/application/groceries/GroceryService.test.ts` and `src/application/ingredients/IngredientService.test.ts` for the pattern to copy for a new service test.
- **Domain tests are pure `describe`/`it`/`expect`**, no fakes needed — e.g. `src/domain/tags/Tag.test.ts`, `src/domain/shared/UnitRegistry.test.ts`, `src/domain/shared/presentQuantity.test.ts`.
- **Backup round-trip tests** exercise the Zod schema directly (`backupFileSchema.safeParse(...)`), including a deliberate case per additive field proving a legacy/foreign/unrecognized value (e.g. a `dishType` outside the curated list, a `locale` outside the current `UI_LOCALES`) survives export → parse unchanged. See `src/application/backup/backupSchema.test.ts`.
- New pure logic in `domain/` or a new `application/*Service` should ship with a same-directory `*.test.ts` file following whichever of the two patterns above fits. UI code (`src/ui/**`) has no established test convention yet beyond `src/ui/catalog/catalogModel.test.ts`/`pickerWhyThis.test.ts`, which test pure data-shaping functions exported from otherwise-React files, not components.

## Test Categories

- **Domain unit tests**: pure functions and type helpers with no dependencies (`normalizeIngredientName`, `presentQuantity`, `UnitRegistry` lookups, `shoppingSections` helpers, etc.).
- **Application service tests**: a service's public methods against in-memory fake repositories — the primary category, covering identity/collision logic (`TagService`, `IngredientService`), aggregation (`GroceryService`, `QuantityService`), import parsing (`parseIngredientLine`, `normalizeImportedRecipe`), and backup round-trips (`BackupService`, `backupSchema`).
- **Manual/browser verification**: anything that needs a real browser or IndexedDB — Dexie migrations against existing local data, PWA install/offline behavior, and any UI flow. Report explicitly which manual checks were and weren't performed; do not claim UI correctness from Vitest passing alone.
