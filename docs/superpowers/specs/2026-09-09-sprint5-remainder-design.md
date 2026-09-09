# Sprint 5 remainder — design

Approved in chat 2026-09-09. Completes deferred Sprint 5 work on top of batch-reuse core.

## Goal

Prep sessions with effort units, meal favorites, recipe pairings + fuse.js picker, and full soft-prompt SPEC via global Settings. Dexie/backup **v5**.

## Approach

Persist auto-managed `prepSessions` (one per `(planId, date)`), plus `mealFavorites` / `recipePairings`. Extend global `Settings` only (no per-plan preference overrides). Pure helpers for effort, suggestion ranking, and soft prompts.

## Prep sessions & effort

- Auto by date: creating/rescheduling a cooking event upserts the session for that date and sets `sessionId`.
- Orphan sessions deleted when empty.
- No manual session CRUD; `time` / `label` fields unused for now.
- `effortUnits(n) = n <= 0 ? 0 : 1 + 0.5 * (n - 1)` where `n` is cooking events in the session.
- Week shows `Prep · X`; Today shows “Preparation today”.

## Favorites

- Named templates of recipe/simple-food refs + quantities (not cooking-event IDs).
- Save from MealEditor; insert validate-then-apply (cook-new per recipe line).
- Feed Suggested section when a slot already has a paired favorite component.

## Pairings & picker

- Explicit user-approved `pairs-with` links only.
- `fuse.js` for fuzzy search/ranking — never ingredient identity merge.
- Suggested order: pairings → favorites → roles/tags → variety/veg prefs.

## Soft prompts & settings

Global Settings: `maxBatchPrepUnits`, `preferredBatchPrepDays`, `quickMealsOnlyDays`, `avoidMultipleDemandingPreps`, `favorVegetablesDaily`.

Non-blocking alerts for: over max prep units, multiple demanding preps, non-quick on quick-only day, repeated breakfast, consecutive identical dinners, vegetable gap, prep outside preferred days, previous-week recipe reuse.

Skip unspecified “reusable weekly meal-slot structure”.

Vegetable detection: role `vegetable` OR tag `vegetable`.

## Out of scope

Per-plan preference overrides · manual session split/merge · dedicated Move-preparation wizard · Sprint 6 imports.
