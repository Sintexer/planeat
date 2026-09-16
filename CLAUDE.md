# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Further documentation

`AGENTS.md` above covers commands, layering, conventions, and the libraries table. For deeper context beyond that:

- `docs/architecture.md` — stack rationale and cross-cutting decisions about the supportive libraries (what each one is/isn't allowed to be used for), plus known limitations such as the current `cup`/`tbsp` unit-alias behavior being replaced in Sprints 12–13.
- `docs/data-model.md` — Dexie schema version history (what each `.version(n)` block added) and how the Dexie schema version and backup format version are separate, independently-bumped contracts.
- `docs/functional-spec.md` — screen-by-screen product behavior (Plan, Lists, Recipes, Settings).
- `docs/sprints/plan.md` — the sprint-by-sprint roadmap; its "Status" section at the bottom records what's shipped and what's next. Check this before starting new feature work.
- `SPEC.md` — the full product specification.
