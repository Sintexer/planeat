# PlanEat

Local-first family menu planner: seven-day meals, reusable prep, grocery lists, and a recipe library. React + Mantine + Dexie (IndexedDB) + Vite PWA. No backend; core flows work offline after first load.

## Key Project Documentation

| Document                                           | Description                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [README.md](README.md)                             | This file — the developer front door                                                                      |
| [AGENTS.md](AGENTS.md)                             | Commands, layering rules, conventions, and the libraries table — canonical agent/contributor instructions |
| [CLAUDE.md](CLAUDE.md)                             | Alias for Claude Code; imports `AGENTS.md` verbatim                                                       |
| [docs/architecture.md](docs/architecture.md)       | Stack, layers, library constraints, and design decisions                                                  |
| [docs/data-model.md](docs/data-model.md)           | Dexie schema and backup format version history                                                            |
| [docs/functional-spec.md](docs/functional-spec.md) | Screen-by-screen current product behavior                                                                 |
| [docs/testing.md](docs/testing.md)                 | Test tooling, conventions, and how to run a single test                                                   |
| [docs/DESIGN.md](docs/DESIGN.md)                   | UI conventions, Mantine theme, and component patterns                                                     |
| [deployment/README.md](deployment/README.md)       | Building and hosting the static PWA output                                                                |
| [docs/sprints/plan.md](docs/sprints/plan.md)       | Sprint cards and **what to build next** (Status at the bottom)                                            |
| [docs/roadmap.md](docs/roadmap.md)                 | Phase-level shipped vs remaining                                                                          |
| [SPEC.md](SPEC.md)                                 | Original product rules (MVP definition and domain rules)                                                  |

## Project Structure

```text
planeat/
├── docs/                       # Architecture, data model, functional spec, testing, design, sprint plan
│   ├── audits/                 # Point-in-time implementation audits
│   └── sprints/plan.md         # Sprint-by-sprint roadmap and status log
├── public/                     # Static assets, PWA icons (generated, see below)
├── src/
│   ├── app/                    # Bootstrap, router, providers, theme — composition root
│   ├── domain/                 # Pure types and rules — no React, no Dexie
│   │   ├── ingredients/ tags/ recipes/ plans/ groceries/ simpleFoods/ favorites/
│   │   ├── pairings/ planning/ libraryViews/
│   │   └── shared/              # Cross-cutting domain types (Quantity, UnitRegistry, Locale, LocalDate, Settings)
│   ├── application/            # Use-case services + repository contracts (ports)
│   │   ├── ports/                # Repository interfaces implemented by infrastructure/
│   │   └── <feature>/            # One service per domain area, mirroring src/domain/*
│   ├── infrastructure/         # Dexie database + migrations, repository implementations, PWA glue
│   │   └── db/migrations/        # Additive `.version(n)` blocks — never edit a shipped version
│   └── ui/                     # Layouts, screens, components, hooks
│       └── hooks/                 # The only place in ui/ allowed to reach infrastructure/db directly
├── AGENTS.md                   # Canonical agent/contributor instructions
├── CLAUDE.md                   # Imports AGENTS.md
├── SPEC.md                     # Original product rules
└── package.json
```

Dependency direction is `ui → application → domain` and `infrastructure → application/ports + domain`, enforced by `eslint-plugin-boundaries` — see [docs/architecture.md](docs/architecture.md) for the full rationale.

## Quick Start: Working With This Repo

No backend, no API keys, no cloud services, and no environment configuration are required — this is a local-first, offline-capable PWA. Local data lives entirely in the browser's IndexedDB.

### Prerequisites

- [Bun](https://bun.sh) (use `bun`, not `npm`, for every command below)
- Node.js `>=22.0.0 <23.0.0` (see `package.json` `engines`; also pinned in `.nvmrc`)

### One-Time Setup

```bash
bun install
```

### Per Dev Session

```bash
bun run dev
```

## Useful Commands

| Command                  | Description                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `bun run dev`            | Start the Vite dev server                                                             |
| `bun run build`          | Type-check (`tsc -b`) and produce a production build in `dist/`                       |
| `bun run preview`        | Preview the production build locally                                                  |
| `bun run lint`           | ESLint, including the `eslint-plugin-boundaries` layering checks                      |
| `bun run typecheck`      | `tsc -b --noEmit`                                                                     |
| `bun run format`         | Format the repo with Prettier                                                         |
| `bun run format:check`   | Check formatting without writing                                                      |
| `bun run test`           | Run the Vitest suite (domain/application unit tests, in-memory doubles, no Dexie/DOM) |
| `bun run generate-icons` | Regenerate `public/` PWA icons from `public/favicon.svg`                              |

Run format, lint, typecheck, and test before considering any change complete — see [AGENTS.md](AGENTS.md).

## Next Work

Sprints 1–25 are shipped. Next is checkpoint D, then a Phase 6 lane chosen from household-trial evidence — see "Phase 5 — Reliability and household validation" and the Status section in [docs/sprints/plan.md](docs/sprints/plan.md). Do not invent work from older "Next" headings elsewhere or from Cursor plan files.
