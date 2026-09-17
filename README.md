# PlanEat

Local-first family menu planner: seven-day meals, reusable prep, grocery lists, and a recipe library. React + Mantine + Dexie (IndexedDB) + Vite PWA. No backend; core flows work offline after first load.

## Run

Use `bun`, not npm:

```bash
bun install
bun run dev          # Vite
bun run test         # Vitest (domain/application, no Dexie/DOM)
bun run lint
bun run typecheck
bun run build
```

Agent/contributor conventions: [`AGENTS.md`](AGENTS.md).

## Docs

| Doc                                                  | What it is                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| [`docs/sprints/plan.md`](docs/sprints/plan.md)       | Sprint cards and **what to build next** (Status at the bottom) |
| [`docs/roadmap.md`](docs/roadmap.md)                 | Phase-level shipped vs remaining                               |
| [`docs/functional-spec.md`](docs/functional-spec.md) | Screen-by-screen current product behavior                      |
| [`docs/data-model.md`](docs/data-model.md)           | Dexie schema and backup format versions                        |
| [`docs/architecture.md`](docs/architecture.md)       | Stack, layers, library constraints                             |
| [`SPEC.md`](SPEC.md)                                 | Original product rules (MVP definition and domain rules)       |

## Next work

**Sprint 20 — grocery shopping sections** is next. Later sequenced work is Sprints 21–22.

Start from the Status section in [`docs/sprints/plan.md`](docs/sprints/plan.md#status). Do not invent work from older “Next” headings in this README or from Cursor plan files.
