# Agent instructions

This is a local-first family menu planner: React + Mantine + Dexie (IndexedDB) + Vite PWA, no backend.

## Commands

Use `bun`, not `npm`:

```bash
bun install
bun run dev         # Vite dev server
bun run build       # tsc build + vite production build
bun run preview     # preview production build
bun run lint        # eslint .
bun run typecheck   # tsc -b --noEmit
```

Run lint, typecheck, and build before reporting a task complete. Report any manual/browser verification you did not perform.

## Layering — follow strictly

```
src/ui             → src/application → src/domain
src/infrastructure → src/application/ports + src/domain
src/app            → wires everything together (composition root)
```

- `domain/` never imports React or Dexie.
- `application/ports/` defines repository contracts; `infrastructure/` implements them.
- UI screens/components never call Dexie tables directly — go through a `ui/hooks/*` hook or an `application` service, obtained via `useServices()` (`src/app/servicesContext.ts`).
- `src/app/bootstrap.ts` wires dependencies explicitly. No DI framework.

## Conventions

- Prefer existing Mantine components (`@mantine/core`, `@mantine/form`, `@mantine/dates`, `@mantine/notifications`) over building custom controls. Only add a domain component (e.g. `MealCard`) when it composes Mantine components for a specific app behavior.
- Do not add a dependency without explaining why it's needed for a specific feature.
- No network dependency for core workflows — everything must work offline after first load.
- Meal/plan dates are local calendar strings (`YYYY-MM-DD`), never UTC timestamps — see `src/domain/shared/LocalDate.ts`.
- Never introduce pantry/inventory accounting implicitly — grocery lists are explicit, not derived stock tracking.
- Preserve local data through schema changes: only add new `.version(n)` blocks in `src/infrastructure/db/migrations`, never edit a shipped version.
- Unsaved recipe/plan edits live in a `@mantine/form` draft until Save — do not write every keystroke to IndexedDB.
- No test runner in this project (by design, MVP stage).
