# Batch reuse core (Sprint 5 vertical) — design

Approved in chat 2026-09-09. Scope is the core vertical only; full Sprint 5 leftovers stay deferred.

## Goal

Multi-component meals with explicit cook-new vs reuse-existing prep, allocation/reuse enforcement, and dependency-aware remove flows.

## Approach

Persist-as-you-go meal editor (approach A). Cooking events are shared across slots, so each add/edit/remove commits immediately through `PlanService`. Keep Dexie schema **v4** (no prep sessions / favorites / pairings tables).

## Domain rules

- Component sources: new cooking event | existing plan cooking event | simple food.
- **fresh-only** / **same-day**: meal date must equal `scheduledDate`.
- **batch-friendly**: meal date ≥ `scheduledDate`.
- Never allocate before prep; reuse stays plan-scoped.
- Sum of allocations ≤ `outputQuantity` (compatible units via `QuantityService`).
- Over-allocate → guided modal: increase output / reduce this allocation / create another cooking event.
- Unallocated remainder → non-blocking warning in MealEditor.
- Orphan cooking events deleted only when no components reference them.

## UI

- MealSlotCard lists all components; tap opens MealEditor.
- `+ Component` → pick recipe/simple food → for recipes, explicit source step (Cook new / Use existing).
- Shared-prep remove/clear lists affected meals via `@mantine/modals`.

## Out of scope

Prep sessions / effort units · favorites · pairings · fuse.js · soft prompts · plan preference settings · Dexie v5.
