# Agent instructions

This is a local-first family menu planner: React + Mantine + Dexie (IndexedDB) + Vite PWA, no backend.

Avoid using browser verification unles user asks for it

## Commands

Use `bun`, not `npm`:

```bash
bun install
bun run dev             # Vite dev server
bun run build           # tsc build + vite production build
bun run preview         # preview production build
bun run lint            # eslint . (includes architecture-boundary checks)
bun run typecheck       # tsc -b --noEmit
bun run format          # prettier --write .
bun run format:check    # prettier --check .
bun run generate-icons  # regenerate public/ PWA icons from public/favicon.svg
bun run test            # vitest run — domain/application unit tests (no Dexie/DOM)
```

Run format, lint, typecheck, and build before reporting a task complete. Report any manual/browser verification you did not perform.

## Layering — follow strictly

```
src/ui             → src/application → src/domain
src/infrastructure → src/application/ports + src/domain
src/app            → wires everything together (composition root)
```

- `domain/` never imports React or Dexie.
- `application/ports/` defines repository contracts; `infrastructure/` implements them.
- UI screens/components never call Dexie tables directly — go through a `ui/hooks/*` hook or an `application` service, obtained via `useServices()` (`src/app/servicesContext.ts`). `ui/hooks/*` is the one place in `ui/` allowed to reach `infrastructure/db` directly (e.g. `useRecipes.ts`, `useSettings.ts`), so that reactive queries don't need a service round-trip.
- `src/app/bootstrap.ts` wires dependencies explicitly. No DI framework.
- These boundaries are enforced by `eslint-plugin-boundaries` (see `eslint.config.js`) — a small, coarse rule set (`domain`/`application`/`infrastructure`/`ui-hooks`/`ui`/`app`), not a full architectural policy. `bun run lint` fails on a violation.

## Conventions

- **Check what's already a dependency before adding a helper or a new library.** See "Libraries" below for what's installed and what's kept in reserve — don't reach for a new package if one of those already covers the need, and don't add a library outside this list without explaining why in the moment.
- Prefer existing Mantine components (`@mantine/core`, `@mantine/form`, `@mantine/dates`, `@mantine/notifications`, `@mantine/modals`) over building custom controls. Only add a domain component (e.g. `MealCard`) when it composes Mantine components for a specific app behavior.
- Centralize confirmation dialogs (delete, replace-data, dependent-meal edits, list overwrites) through `@mantine/modals`' `modals.openConfirmModal` rather than each screen rolling its own modal-open state — see `SettingsScreen.tsx`'s restore-backup confirmation for the pattern.
- No network dependency for core workflows — everything must work offline after first load.
- Meal/plan dates are local calendar strings (`YYYY-MM-DD`), never UTC timestamps — see `src/domain/shared/LocalDate.ts`. Locale and measurement **presentation** settings must not change stored quantities, IDs, or week boundaries.
- Never introduce pantry/inventory accounting implicitly — grocery lists are explicit, not derived stock tracking. `isCommon` means “usually have at home” (prechecked on new lists), not stock on hand.
- Ingredient **identity is the ID**. Names, aliases, and translations are metadata. `fuse.js` proposes picker candidates; it must not merge catalog records. Do not assign a language to existing aliases during migration.
- Preserve local data through schema changes: only add new `.version(n)` blocks in `src/infrastructure/db/migrations`, never edit a shipped version. Dexie schema version and backup format version are separate contracts.
- Unsaved recipe/plan edits live in a `@mantine/form` draft until Save — do not write every keystroke to IndexedDB.
- Shared catalog UI may list recipes and simple foods together; do not collapse them into one persistence model.
- `bun run test` is Vitest: domain/application unit tests with in-memory repository doubles — no Dexie/IndexedDB polyfill, no DOM/testing-library. Format/lint/typecheck/build remain the completeness gate alongside tests. Measurement/grocery scenario tests live in `QuantityService.test.ts` and `GroceryService.test.ts`.
- Format with `bun run format` (Prettier); style is not a lint concern here.

## Libraries

Already installed, beyond the core stack (React/Mantine/Dexie/Zod/Day.js/vite-plugin-pwa):

| Library                                                    | Used for                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@mantine/modals`                                          | Centralized confirmation dialogs                                                                                                                                                                                                                                                     |
| `prettier`                                                 | Formatting (`bun run format`)                                                                                                                                                                                                                                                        |
| `eslint-plugin-boundaries` + `eslint-import-resolver-node` | Enforces the layering above                                                                                                                                                                                                                                                          |
| `@vite-pwa/assets-generator`                               | Regenerates `public/` PWA icons from one source SVG (`pwa-assets.config.ts`, `bun run generate-icons`)                                                                                                                                                                               |
| `fraction.js`                                              | Recipe quantity scaling via `QuantityService`                                                                                                                                                                                                                                        |
| `convert-units`                                            | Compatible mass/volume aggregation via `QuantityService.add` / `canConvert` (resolves units via `UnitRegistry`; legacy `cup` is self-only; `tsp`/`tbsp` convert with known volumes; grocery mixed volumes total in `ml`; `cup-metric` has no library equivalent and stays self-only) |
| `fuse.js`                                                  | Fuzzy recipe/component picker search and ranking (never ingredient identity merge)                                                                                                                                                                                                   |
| `@mantine/dropzone`                                        | Recipe import file drop target (always paired with a visible Choose file button)                                                                                                                                                                                                     |
| `schema-dts`                                               | Compile-time Schema.org `Recipe` typing for JSON-LD import (Zod remains runtime validation)                                                                                                                                                                                          |
| `@phosphor-icons/react`                                    | App-wide icon set (design schema); Regular weight by default, Fill for active/selected states. Replaces `@tabler/icons-react`.                                                                                                                                                       |

No further libraries are currently earmarked for a scheduled sprint.

Deliberately kept in reserve, not scheduled: `fflate` (only if backups need compression/photos), `DOMPurify` (only if we render imported HTML), `Papa Parse` (only for CSV import/export), `@dnd-kit/core` (only if drag-and-drop planning is added), `TanStack Virtual` (only if recipe lists get large enough to need it), `Immer` (only if immutable plan-editing genuinely gets unwieldy without it).

Prefer native browser APIs over a wrapper package for: IDs (`crypto.randomUUID()`), JSON backup download (`Blob` + object URL), file reading (`File.text()`), number formatting (`Intl.NumberFormat`), clipboard (Clipboard API), sharing (Web Share API, with a copy/download fallback), and storage persistence (`navigator.storage.persist()` / `.estimate()`).

## Further documentation

- `docs/architecture.md` — stack rationale and cross-cutting decisions about the supportive libraries (what each one is/isn't allowed to be used for), plus known limitations such as `cup-metric`'s unit conversion (no library equivalent, self-only by design — see the `convert-units` row in `AGENTS.md`'s Libraries table).
- `docs/data-model.md` — Dexie schema version history (what each `.version(n)` block added) and how the Dexie schema version and backup format version are separate, independently-bumped contracts.
- `docs/functional-spec.md` — screen-by-screen product behavior (Plan, Lists, Recipes, Settings).
- `docs/sprints/plan.md` — sprint cards; **Status at the bottom is the source of truth for shipped work and the next sprint**. Check it before starting feature work. `[docs/roadmap.md](docs/roadmap.md)` is the phase-level view. `[README.md](README.md)` links the same Status section.
- `SPEC.md` — the full product specification.
