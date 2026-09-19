# Phase 7 — Automatic meal planning (Sprints 28–38)

Local, explainable generation on top of the existing cooking-event model. No backend and no LLM. Status of what is shipped lives in [`plan.md`](plan.md). This file is the implementation backlog for the sequence.

Keep the app releasable after every sprint. Manual planning remains the default path; generation is an optional assist that writes a **proposal**, never the plan itself.

## Why this sequence

Checkpoint D and Lanes A/C are shipped. The next product investment is the **planning assistant** row in the strategic table: reuse structured recipe metadata, household preferences, and cooking events to fill empty meals. The app stays a private local household utility.

Lane B (shopping-section order) remains optional and is not a prerequisite.

Do not delay household trials until Sprint 38. Use generated proposals from Sprint 29 onward; treat observed replacements and failures as inputs to later slices.

## Release gates

| Gate                         | Sprints | Capability                                                                 |
| ---------------------------- | ------- | -------------------------------------------------------------------------- |
| **Initial generator**        | 28–29   | Safely fill empty meals with preview and explicit apply.                   |
| **Preference-aware planner** | 30–32   | Respect restrictions and optimize across the week.                         |
| **Household meal planner**   | 33–35   | Generate compositions, allocate leftovers, and schedule batches.           |
| **Core-feature release**     | 36–38   | Selective regeneration, reusable configuration, and validated performance. |

## Shared implementation requirements

Apply these to every sprint in this phase.

- Generation produces a **proposal**. Never mutate `plans` / `mealSlots` / `mealComponents` / `cookingEvents` during search.
- Apply through existing `PlanService` operations (`addNewCookingEventComponent`, `linkExistingCookingEvent`, `addSimpleFoodComponent`, and later dependent-meal flows). Reuse snapshot, scaling, reuse-policy, and allocation checks. Do not invent a second write path.
- Preserve filled meals and excluded slots unless a later sprint explicitly opts into replacement (Sprint 36).
- Revalidate the proposal against current data immediately before an atomic commit.
- Reject stale proposals when relevant plan, recipe, simple-food, tag, pairing, favorite, or generation-configuration data has changed.
- Never automatically update grocery lists. Plan changes never imply list changes; cooks still use **Generate groceries** / **Update from plan**.
- Keep generation offline. No network, no model API, no remote ranking.
- New persisted fields get backup/restore support in the same sprint (additive Dexie `.version(n)` only when tables or indexes require it).
- Hard constraints are never silently relaxed. Missing metadata is not a qualifying value.
- Tests must distinguish **no eligible candidates** from **search did not find a complete plan** (including budget exhaustion). User-facing errors return `PlanResult`-style codes from services, not thrown exceptions, unless state is corrupted.

### Module boundaries

Existing meal entities stay in `src/domain/plans/`. Generation algorithms are a new subtree that **calls** those types; they do not duplicate Plan/MealSlot/CookingEvent.

```text
src/domain/plans/generation/
  candidates.ts
  constraints.ts
  scoring.ts
  search.ts
  proposal.ts
  proposalValidation.ts

src/application/plans/GenerationService.ts
  prepareGeneration
  runGeneration
  applyProposal

src/infrastructure/planning/
  generationWorker.ts   # Sprint 29+
```

`eslint-plugin-boundaries` already allows `infrastructure → domain + application`. The worker may import generation domain functions. It must not import Dexie, React, or `ui/`.

`prepareGeneration` runs on the main thread, loads repositories, and builds an **immutable generation input snapshot**. `runGeneration` is a pure function of that snapshot (main thread in tests; worker in the app from Sprint 29). `applyProposal` re-reads live data, revalidates, then commits through `PlanService` in one Dexie transaction.

Vitest stays node-only, no Dexie/DOM. Cover generation with domain tests and `GenerationService` tests against in-memory fakes. Worker wiring is a build/manual gate until Sprint 38.

### Reuse, do not rebuild

| Need                   | Already in the app                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Occasion               | `Recipe.mealTypes` / slot `mealType`                                                                                                                                        |
| Standalone eligibility | `Recipe.roles` includes `complete`. Do **not** treat `main` as sufficient.                                                                                                  |
| Household size / yield | `Plan.peopleCount`, `defaultPortionPerPerson`, `QuantityService.scale`                                                                                                      |
| Plan dirty check       | `Plan.revision` (necessary but not sufficient — also fingerprint library + policy)                                                                                          |
| Soft household prefs   | `Settings.quickMealsOnlyDays`, `avoidMultipleDemandingPreps`, `favorVegetablesDaily`, `maxBatchPrepUnits`, `preferredBatchPrepDays`; `Recipe.effort`, `maxPreferredRepeats` |
| Filter facet math      | OR within a facet, AND between facets (`itemMatchesFilters`)                                                                                                                |
| Ingredient identity    | Catalog IDs, not title matching. Unlinked lines are unknown.                                                                                                                |
| Unknown time           | Missing `totalTimeMinutes` is not zero (Sprint 18)                                                                                                                          |
| Leftovers              | `listEligibleCookingEvents`, `remainingSameUnit`, `checkReusePolicy`                                                                                                        |
| Compositions           | `MealFavorite`, `RecipePairing`, `SimpleFood.enabledInSuggestions`                                                                                                          |
| Workload heuristic     | `prepEffort.ts` / `effortUnitsForDate` — do not present summed `totalTimeMinutes` as elapsed meal time                                                                      |
| Confirmations          | `@mantine/modals`                                                                                                                                                           |
| Named config UX        | Saved library views: dirty indicator, explicit Update vs Save as new                                                                                                        |

### Split rule for this phase

If a sprint cannot finish both the algorithm and a visible Plan-screen control, split at the user-visible boundary (for example 29a multi-slot preview on the main thread, 29b worker). Do not pull Sprint 30 constraints into Sprint 29 to “make the week look smarter.”

---

## Sprint 28 — Generate one empty meal

**User outcome:** “I can ask the app to fill one empty slot and accept or discard the suggestion.”

### Implementation card

1. **User story.** As a household cook, I pick one empty breakfast, lunch, or dinner, generate a single newly cooked recipe scaled for this plan, preview it, and either apply it or cancel.

2. **Journeys**
   - Empty Tuesday dinner, at least one recipe with role `complete` and `mealTypes` including dinner → proposal shows the recipe and scaled quantity; Apply creates a cooking event, snapshot, and component equivalent to **Cook new** in the meal editor.
   - Preview then Cancel → plan, events, and grocery lists unchanged.
   - No recipe is eligible for that occasion → empty result with an explicit **no eligible candidates** reason, not a generic failure.

3. **Non-goals.** Simple foods, favorites, pairings, leftovers, weekly search, preference scoring, Web Worker, overwriting filled or excluded slots.

4. **Data and backup impact**
   - Prefer existing `complete` role as the opt-in for automatic standalone selection. Clarify editor/help copy so cooks know `complete` means “may be chosen alone.” Do not infer eligibility from `main`.
   - Add a separate optional classification only if `complete` is already used in the household catalog in a way that would flood or starve the candidate set; if added, it is optional, additive, and backup-round-tripped.
   - Proposals are session state, not Dexie rows. Capture `algorithmVersion`, request id, and an input fingerprint (plan id + `revision` + candidate recipe identities/`updatedAt` + people count + policy version).
   - No grocery schema changes.

5. **Acceptance tests**
   - An eligible recipe produces a correctly scaled proposal (`QuantityService.scale` / plan `peopleCount`, same as `PlanService.addNewCookingEventComponent`).
   - Preview and cancel persist nothing.
   - Apply uses `PlanService` and yields the same entities as manual cook-new (snapshot tags are frozen labels, not live ids).
   - Filled or excluded slots cannot be overwritten; request is rejected with a structured error.
   - Zero eligible recipes → `no-eligible-candidates` (distinct from search-incomplete, which this sprint should not emit).
   - Changing the recipe, plan revision, or household size invalidates the fingerprint; apply is rejected and the plan is unchanged.
   - Failed apply (validation error, transaction failure) leaves the plan unchanged.
   - Grocery lists stay unchanged.

6. **Demo script.** Plan with an empty dinner. Mark one soup as Complete + Dinner. Generate → preview scaled portions → Cancel (still empty) → Generate → Apply. Open the meal: snapshot and cooking event match a manual add. Exclude Friday dinner and confirm Generate is unavailable/rejected. Edit the soup name, return, Apply on the old proposal → stale. Confirm the grocery list (if any) is untouched.

**Shipped.** Domain generation under `src/domain/plans/generation/`; `GenerationService` apply via `PlanService.addNewCookingEventComponent`; Plan day-slot Generate + preview.

**Work chunks**

1. Proposal types + fingerprint + `proposalValidation` (slot empty, not excluded, recipe still eligible, quantities valid).
2. Deterministic candidate filter (occasion + `complete`) and stable selector (sorted by recipe id, then name; first match — seed comes in Sprint 29).
3. `GenerationService.prepare` / `run` / `apply` / `cancel`; apply delegates to `PlanService`.
4. Plan UI: Generate on an empty slot, preview (recipe, occasion, quantity), Apply / Cancel.
5. Tests: eligibility, scaling, stale fingerprint, excluded/filled slot, grocery untouched (service-level: apply does not call `GroceryService`).

---

## Sprint 29 — Fill selected empty slots for a week

**User outcome:** “I can generate suggestions for several empty meals this week without freezing the app, and apply only what I accept.”

### Implementation card

1. **User story.** As a household cook, I select empty days and occasions, optionally override portions per slot, generate a proposal, and apply it atomically while existing meals stay put.

2. **Journeys**
   - Week with Monday dinner already planned and Friday dinner excluded. Request lunches Mon–Thu → only those empty lunches may receive assignments; Monday dinner and Friday dinner are unchanged.
   - Start generation, Cancel before it finishes → no plan writes; a late worker message from that request id is ignored.
   - Partial proposal (some requested slots unfilled) → Apply writes filled slots only; unfilled requested slots stay empty.

3. **Non-goals.** Soft-preference optimization, replacing existing meals, leftovers, new batches, combinatorial pairings.

4. **Data and backup impact.** Per-slot portion overrides live on the request, not on `MealSlot`, unless a later sprint persists them. Worker code is not a Dexie table. Record `algorithmVersion` and `seed` on the proposal. No grocery changes.

5. **Acceptance tests**
   - Only requested empty slots receive assignments.
   - Existing meals, cooking events, and exclusions remain unchanged.
   - Same input snapshot, seed, and algorithm version → same proposal.
   - Cancellation produces no plan changes.
   - Late result from a canceled or superseded request id is discarded.
   - Partial proposals apply without touching unfilled slots.
   - UI remains usable during generation (worker; main thread does not run search).

6. **Demo script.** Fill one dinner manually. Select empty lunches. Generate. Confirm the dinner is still the manual meal. Cancel a second run mid-flight. Apply a partial proposal. Toggle airplane mode; generation still runs.

**Work chunks**

1. Extend the request: slot ids or day×occasion set; optional quantity per slot; seed.
2. Independent per-slot selection with stable candidate order; allow explicit unfilled slots + reasons (`no-eligible-candidates` vs later `search-incomplete`).
3. Immutable input snapshot; Web Worker; request id; ignore obsolete messages. Document the worker in `docs/architecture.md` when it ships.
4. Atomic apply of N new cook-new components in one transaction; revalidate the whole proposal first.
5. Plan UI: multi-select empty slots, progress/cancel, partial-proposal summary.

**Split.** If the worker and multi-slot UI cannot ship together: 29a multi-slot generate on the main thread with preview/apply; 29b move search to the worker (user-visible: UI stays responsive). Do not start Sprint 30 until 29a exists.

**Shipped.** Multi-slot request + independent picks + worker (`src/infrastructure/planning/generationWorker.ts`); atomic `addCookingEventComponents`; Plan **Generate meals** picker with progress/cancel and partial preview.

---

## Sprint 30 — Strict eligibility configuration

**User outcome:** “The generator will not suggest recipes that break the rules I turned on.”

### Implementation card

1. **User story.** As a household cook, I set hard restrictions (excluded recipes, tags, ingredients, maximum recorded total time, occasion) and unknown-data policies, then generate knowing every assignment obeys them.

2. **Journeys**
   - Exclude a catalog ingredient by id; recipes that contain it are dropped; recipes with only unlinked lines follow the chosen unknown-ingredient policy, not title matching.
   - Strict max total time 30 minutes; a recipe with missing `totalTimeMinutes` is excluded unless the policy explicitly allows unknown time.
   - A Monday dinner already planned with an excluded recipe stays; diagnostics report the conflict on a **fixed** meal without rewriting it.

3. **Non-goals.** Dietary certification, allergen-safety claims, soft weights, relaxing a failed run automatically.

4. **Data and backup impact.** Persist household generation **hard-policy** (settings row and/or a dedicated config object). Additive backup fields; Dexie bump only if a new table or index is required. Unknown-data policies are explicit enum fields (never inferred). Validate referenced recipe/tag/ingredient ids on restore; missing refs are reported, not treated as “no restriction.”

5. **Acceptance tests**
   - Every generated assignment satisfies all enabled hard restrictions.
   - Unknown times do not pass a strict time limit unless permitted.
   - Ingredient include/exclude uses ingredient ids. State include semantics in the model (for example: include means “at least one listed id is linked on the recipe”).
   - Unresolved ingredient lines follow the selected unknown-data policy.
   - Fixed conflicting meals are preserved and listed in diagnostics.
   - Zero-candidate diagnostics name the relevant facets (counts per restriction).
   - Restrictions are never relaxed without a new user-confirmed request.

6. **Demo script.** Enable “exclude peanuts” + max 45 minutes. Generate a lunch. Confirm the pick has linked ingredients without peanut and a recorded time ≤ 45, or the result is no-eligible-candidates with counts. Leave a recipe unlinked-only and show both unknown policies. Confirm a pre-filled conflicting dinner is still there.

**Work chunks**

1. Policy model: excluded recipe ids; required/excluded tag ids; include/exclude ingredient ids; max total time; occasion (usually the slot); unknown time / unknown ingredient enums.
2. Candidate filter + structured exclusion reasons; reuse OR-within / AND-across facet rules.
3. Settings UI for the policy; request may pass the stored household policy in Sprint 30 (per-request overrides wait for Sprint 37 if that keeps this slice small).
4. Tests for each facet, unknown policies, fixed-meal conflict reporting.

Facet semantics: **OR within a selected-value facet, AND between facets.** Hard constraints stay in `constraints.ts`; scoring must not live here yet.

**Shipped.** Household `generationHardPolicy` on Settings; `src/domain/plans/generation/constraints.ts`; Settings generation section; proposal diagnostics (facet counts + fixed conflicts). No Dexie or backup-format bump.

---

## Sprint 31 — Household preferences and scoring

**User outcome:** “Suggestions prefer quicker days and less repetition without breaking the rules.”

### Implementation card

1. **User story.** As a household cook, I keep using existing planning settings (quick-meal days, demanding-prep avoidance, vegetable preference, batch-prep days/units) and see why a suggestion was chosen.

2. **Journeys**
   - Wednesday is a quick-meal-only day; among valid complete dinners, the lower-effort / known-quick option is preferred. Missing time is not treated as zero-effort.
   - A recipe already used as a **fixed** Monday lunch counts toward repetition; the generator avoids repeating it for a requested Thursday lunch when alternatives exist.
   - Score breakdown on the preview lists reason codes that match scoring inputs (quick-day, repetition, effort, preferred tags, workload). Previous-week plan contents, if used, are labeled as **planned history**, not confirmed cooking.

3. **Non-goals.** User-editable numerical weights, nutrition, cost, replacing independent selection with beam search (Sprint 32).

4. **Data and backup impact.** Prefer existing `Settings` fields. Add only fields the current settings cannot express (for example preferred tag ids for generation). Internal weight tables are versioned in code (`scoring.ts` + `algorithmVersion`), not household-editable. Backup any new settings fields.

5. **Acceptance tests**
   - A better preference score cannot justify a hard-constraint violation.
   - Leaving a requested slot empty cannot win merely by reducing effort (coverage ranks above preference).
   - Fixed meals contribute to repetition and workload.
   - Missing times are not zero.
   - Fixtures prefer lower effort on configured quick-meal days.
   - Explanations correspond to actual scoring inputs.
   - Previous plans used in scoring are described as planned history.

6. **Demo script.** Set Wednesday quick-only. Seed two valid dinners (quick vs demanding). Generate Wednesday dinner; preview shows the quick pick and a quick-day reason. Plan the demanding recipe on Monday; generate Thursday; confirm repetition penalty. Show a recipe with no time; it is not treated as the fastest.

**Lexicographic objective (versioned with `algorithmVersion`):**

1. No new hard-constraint violations.
2. Maximum requested-slot coverage.
3. Minimum important preference penalties.
4. Secondary preference improvements.

Soft preferences: quick-meal days, effort, recipe repetition (include `maxPreferredRepeats` when set), preferred household tags, distribution of active cooking workload (`activeTimeMinutes` as a proxy; do not sum total times as elapsed duration). Reuse `softPrompts.ts` as **signals to encode**, not as the search engine.

**Shipped.** `scoring.ts` lexicographic pick among Sprint 30-eligible recipes; preview score reasons; `generationPreferredTagIds` on Settings. No beam search. No Dexie or backup-format bump.

---

## Sprint 32 — Bounded weekly search

**User outcome:** “The week is planned as a whole, with a time budget, not as seven isolated picks.”

### Implementation card

1. **User story.** As a household cook, I generate a week and get a deterministic, constraint-safe proposal even when the catalog is large, including a partial fill if the budget runs out.

2. **Journeys**
   - Fixture where independent per-slot greedy repeats the same main every day, but beam search spreads repetition and still covers requested slots.
   - Tight budget: returns best-so-far (possibly partial) with reason `search-incomplete` / budget exhausted — **not** “infeasible.”
   - Cancel during search; obsolete results ignored (regression from Sprint 29).

3. **Non-goals.** Batch production, leftover allocation, MIP/CP-SAT or other solvers, unbounded exhaustive search.

4. **Data and backup impact.** Persist search-budget defaults with generation policy (beam width, expansion budget, per-slot candidate limit) as versioned config, not as a new algorithm picker. Proposal records algorithm version, seed, and budget used. Backup those policy fields.

5. **Acceptance tests**
   - Fixed-budget runs are deterministic for a given snapshot + seed + algorithm version + budget.
   - Search produces no invalid assignments.
   - Best-so-far is monotonic: extra valid alternatives never replace the incumbent with a lexicographically worse score.
   - Benchmarks include at least one case where weekly search beats independent selection on the lexicographic objective.
   - Exhaustion returns a valid complete or partial proposal.
   - Diagnostics never claim mathematical infeasibility solely because the budget ended.
   - Cancellation and obsolete-result handling still work.

6. **Demo script.** Seed a catalog that tempts greedy repetition. Generate the week twice with the same seed; proposals match. Lower the budget in a debug/settings field (or test-only config) and show a partial fill with a budget reason. Cancel mid-run.

**Work chunks**

1. Chronological beam search; state = assignments, repetition counts, daily workload, accumulated penalties.
2. Per-slot candidate limits, diversity-preserving pruning, fixed expansion budget, seeded exploration.
3. Best-so-far + explicit unfilled-slot fallback.
4. Independent final `proposalValidation` (do not trust search invariants alone).
5. Tests/fixtures for determinism, monotonicity, vs-greedy, budget exhaustion.

**Split.** If beam search + UI diagnostics overflow capacity: ship search behind the existing generate action first; polish budget diagnostics in a follow-up slice before Sprint 33.

**Shipped.** Chronological beam search in `search.ts` (`algorithmVersion` `32`); persisted `generationSearchBudget` on Settings with backup round-trip; proposal `budgetUsed` / `expansionsUsed`; `search-incomplete` vs `no-eligible-candidates`; Settings budget fields and preview copy. No Dexie or backup-format bump.

---

## Sprint 33 — Known multi-component meals

**User outcome:** “The generator can suggest a favorite or an explicit pairing, not only a single complete dish.”

### Implementation card

1. **User story.** As a household cook, I generate a meal and may receive a known composition (favorite, pairing, or eligible simple food in that composition), with each component scaled and restricted like a manual add.

2. **Journeys**
   - Favorite “cutlets + buckwheat” → two plan components with existing serving semantics; Apply creates the usual snapshots/references.
   - Yogurt has `enabledInSuggestions: false` → never a standalone generated meal; it may still appear if a **known** composition includes it.
   - Pairing expansion is capped; the generator does not invent arbitrary main+side combinations.

3. **Non-goals.** Culinary compatibility inference, meal-adequacy or nutrition claims, leftovers (Sprint 34).

4. **Data and backup impact.** No new composition tables. Bound pairing expansion in policy (max pairings per recipe / max components per candidate). Backup that bound if persisted.

5. **Acceptance tests**
   - Each component is the correct recipe or simple-food entry.
   - Suggestion-disabled simple foods are excluded as standalone candidates.
   - Every component passes applicable hard restrictions.
   - Quantities follow existing scaling / favorite allocated quantities.
   - Known compositions are preserved; arbitrary mains/sides are not invented.
   - Missing time on one component follows the unknown-data policy.
   - Apply creates valid snapshots and references through `PlanService`.

6. **Demo script.** Save a two-component favorite. Generate an empty dinner; preview shows both parts. Disable yogurt in suggestions; confirm it is not proposed alone. Add an explicit pairing; confirm it can appear. Confirm a random main+side that was never paired does not appear.

**Workload:** count each **new** cooking event once; use recorded **active** time as the workload proxy. Do not sum recipe total times and call that elapsed preparation time.

**Shipped.** Composition candidates in `compositions.ts` (`algorithmVersion` `33`): standalone complete recipes, enabled simple foods, stored favorites, and capped stored pairings. Hard excludes apply per component; includes are meal-level. Apply uses `PlanService.addGeneratedMealComponents` in one Dexie transaction. Additive `generationCompositionBounds` on Settings (backup optional object). Preview lists each component and favorite/pairing source. No Dexie or backup-format bump.

---

## Sprint 34 — Allocate existing leftovers

**User outcome:** “The generator uses food I already planned to cook, without over-allocating it.”

### Implementation card

1. **User story.** As a household cook, I generate later meals that may consume remaining portions of existing cooking events, after every fixed future use is reserved.

2. **Journeys**
   - Sunday batch chili with remaining portions; Tuesday lunch empty; Generate may allocate leftovers after Sunday, never before.
   - Wednesday dinner already uses the last remaining portion; Thursday generate must not take that amount.
   - Fresh-only / same-day policies block later-day reuse; notes/freezer text never invent eligibility.

3. **Non-goals.** Increasing existing batches, creating new cook-and-reuse chains (Sprint 35), cross-week inventory.

4. **Data and backup impact.** Proposals distinguish `existing-cooking-event` vs `proposed-new-event` references. No change to stored `outputQuantity` of existing events. Backup unchanged unless policy gains a leftover-preference flag.

5. **Acceptance tests**
   - Reuse only after the source event’s `scheduledDate` and only when `checkReusePolicy` allows it.
   - Allocated consumption never exceeds remaining production after **fixed** future allocations are reserved.
   - Existing event production quantities stay unchanged.
   - Excluded or ineligible sources are not selected.
   - Leftover consumption does not duplicate grocery ingredient requirements (same as today’s leftover dedup) — verified at apply + a documented “when the cook later generates groceries” assertion, not by auto-updating lists.
   - Every proposed reuse names its source event id.
   - Partial portions follow `remainingSameUnit` / `canAllocateSameUnit`; never round up supply.

6. **Demo script.** Cook-new a large batch Monday. Manually allocate part to Monday dinner. Generate Tuesday dinner; preview shows leftover from Monday’s event. Try to generate Sunday breakfast from that event → rejected/not proposed. Confirm grocery list still unchanged until explicit update.

**Shipped.** Leftover is a standalone composition candidate (`algorithmVersion` `34`) linking an existing same-week cooking event after `checkReusePolicy` and remaining (fixed allocations, then search reservation). Apply uses `link-cooking-event` in the same Dexie transaction as cook-new/simple-food; `outputQuantity` is unchanged. Grocery lists stay untouched; leftover grocery dedup remains the existing `GroceryService` leftover-reuse test. No leftover Settings flag. No Dexie or backup-format bump.

---

## Sprint 35 — Generate new batches and planned reuse

**User outcome:** “The generator can cook once and reuse later in the same week, within limits I set.”

### Implementation card

1. **User story.** As a household cook, I allow bounded extra production so one cooking event can cover a later compatible meal, or I forbid leftover production I will not use.

2. **Journeys**
   - Policy allows one extra compatible use: generate cook-once for Monday+Tuesday instead of two cooks, coverage unchanged.
   - Unallocated-production policy **disallow**: a variant that would leave remainder is not chosen.
   - Unallocated-production policy **allow-with-warning**: remainder is visible on the preview with a penalty in the score.

3. **Non-goals.** Storage advice from notes, package-size optimization, leftover inventory into next week.

4. **Data and backup impact.** Persist batch limits and unallocated-production policy on the generation config. Proposal includes proposed cooking events (ids in proposal space) and their produce/consume graph. Backup the policy.

5. **Acceptance tests**
   - New reuse components resolve to valid **proposed** cooking events.
   - Production covers all scheduled consumption; no consumption before production.
   - Structured reuse restrictions (`fresh-only` / `same-day` / `batch-friendly`) are respected.
   - Batch limits are enforced (current meal only; +one later use; no further variants beyond the configured cap).
   - Unallocated production is rejected or visibly reported per policy.
   - Grocery generation (when the cook later runs it) counts each cooking event once — fixtures at apply-time graph, plus an existing `GroceryService` test pattern on a plan produced by apply.
   - Fixtures show fewer cooking events without losing requested coverage.
   - No cross-week leftover inventory.

6. **Demo script.** Enable “cook for one later use.” Generate Mon+Tue dinners with one batch-friendly recipe. Preview: one proposed event, two allocations. Apply. Generate groceries manually: the batch appears once. Switch policy to disallow remainder and confirm a too-large batch variant is not used.

Search-state extensions: proposed events, produced/consumed/remaining portions, future feasible reuse, limited lookahead. Candidate variants: cook only for this meal; cook enough for one compatible later use; additional variants only within explicit batch limits.

**Shipped.** `algorithmVersion` `35`: standalone cook-new variants with bounded extra portions (`generationBatchPolicy.maxExtraPlannedUses`, default 0); proposed leftover remaining in search; unallocated-production `disallow` / `allow-with-warning`; Apply creates one cooking event then `link-cooking-event` in the same transaction. Existing event `outputQuantity` is unchanged. Additive `generationBatchPolicy` on Settings (backup optional object). No Dexie or backup-format bump.

---

## Sprint 36 — Regenerate selected meals and lock content

**User outcome:** “I can lock meals I like and ask the generator to replace only the ones I select, without orphaning leftovers.”

### Implementation card

1. **User story.** As a household cook, I lock slots so generation never touches them, and I can regenerate selected meals after seeing additions, removals, and dependency effects.

2. **Journeys**
   - Fill-empty remains the default control. Locked Tuesday dinner is never changed in fill-empty or replace mode.
   - Replace Wednesday dinner that supplies Thursday leftover → blocked unless the cook confirms including the dependent slot, or the leftover component can remain valid.
   - Preview lists added/removed components and dependency changes; Apply is atomic; Cancel writes nothing.

3. **Non-goals.** Component-level locks, silent cascading replacement, automatic grocery updates.

4. **Data and backup impact.** Additive slot-level generation lock on `MealSlot` (boolean). Dexie bump if the field needs an index; otherwise additive + backup schema. Locks restore with the plan.

5. **Acceptance tests**
   - Fill-empty mode remains the default.
   - Locked meals are never changed.
   - Nonselected meals remain unchanged.
   - Replacing a source event cannot orphan leftover consumption.
   - Dependency expansion requires explicit confirmation (`modals.openConfirmModal`).
   - A locked dependent prevents destructive regeneration.
   - Apply is atomic; stale proposals are rejected.
   - Grocery lists remain unchanged until their own update flow.

6. **Demo script.** Lock a favorite Friday dinner. Generate the week; Friday unchanged. Select a batch source meal, Replace without dependents → blocked. Confirm include dependents → preview shows both meals. Apply. Confirm an unselected lunch is untouched.

Reuse existing dependent-meal analysis from the meal editor (affected meals when removing shared prep).

---

## Sprint 37 — Reusable generation presets

**User outcome:** “I can switch Balanced / Less cooking / More variety / Batch cooking without silently rewriting household defaults.”

### Implementation card

1. **User story.** As a household cook, I pick a named preset, tweak the current request, and save a custom preset only when I choose Save — the same pattern as library views.

2. **Journeys**
   - Request override (exclude one extra recipe this week) does not change Settings household defaults.
   - Edit “Less cooking,” leave without Save → dirty state; generating uses the draft request; reopening the preset restores saved values.
   - Restore a backup: custom presets and built-ins behave; missing tag/recipe refs on a preset are listed, not dropped silently.

3. **Non-goals.** Preset sharing, cloud sync, automatic learning of weights.

4. **Data and backup impact.** Three layers: (1) household defaults on Settings, (2) named presets table, (3) request overrides. Built-in presets are code + stable ids, mapped onto the **same** policy model (Sprint 30–35 fields), not separate algorithms. Dexie table + backup format bump. Versioned policy serialization. Validate referenced tags/recipes on save and restore.

5. **Acceptance tests**
   - Request overrides do not silently change household defaults.
   - Editing a preset requires an explicit save.
   - Built-in presets produce valid configurations.
   - Missing references are reported.
   - Restored presets retain intended settings.
   - Effective policy is captured on the proposal for reproducibility.
   - Existing planning settings are the preference system; presets only bind those fields (no second hidden scorer).

6. **Demo script.** Switch Balanced → Batch cooking, generate, compare cooking-event counts on fixtures. Tweak max time on the request; Settings still shows the old default. Save as “Weeknight.” Export/restore. Delete a tag used by a custom preset; opening it shows the missing ref.

Built-in set: **Balanced**, **Less cooking**, **More variety**, **Batch cooking**. Copy and dirty-indicator UX should follow saved library views (`LibraryViewService`).

---

## Sprint 38 — Quality, performance, and release hardening

**User outcome:** “Generation is trustworthy enough to keep using: fast enough to cancel, reproducible, and measured.”

### Implementation card

1. **User story.** As a household cook, I generate offline after a reload, cancel quickly, and never lose data if the worker dies; quality claims are backed by fixtures or trial notes.

2. **Journeys**
   - Worker throw / terminate → recoverable error; plan unchanged.
   - PWA update while a job is in flight → result from the old worker/session cannot apply.
   - Reload the app offline; prepare + generate still works from IndexedDB.

3. **Non-goals.** New meal types, nutrition, solvers, raising search budget without a named device measurement.

4. **Data and backup impact.** None expected unless a conservative local-improvement pass needs to record a sub-version of `algorithmVersion`.

5. **Acceptance tests**
   - Zero invariant violations across automated randomized tests (handwritten property tests first; add `fast-check` only if generators become unwieldy — explain in `AGENTS.md` if added).
   - Cancellation responds within a documented target (set the number in `docs/testing.md` when measured).
   - Runtime and memory budget agreed for a **named** mid-range Android device; record the device and numbers in the sprint Status note when this ships.
   - Fixed-budget reproducibility remains intact.
   - Worker failure is recoverable and writes nothing.
   - Offline generation succeeds after reload.
   - PWA updates cannot apply obsolete worker/session results (include algorithm/build or session token in the fingerprint).
   - Household trials record coverage, manual replacements, proposal acceptance, and reported quantity errors.
   - Any claimed quality improvement cites fixtures or those trial results.

6. **Demo script.** Generate on a large fixture catalog. Cancel; UI recovers. Kill the worker in DevTools; error toast; plan intact. Apply a proposal, install a dummy update, confirm a stale job cannot apply. Run the benchmark suite in Vitest.

**Work chunks**

1. Benchmark suite: small/incomplete catalogs; large similar recipes; restrictive ingredients; many fixed meals; no-leftover vs batch-cooking; multi-component; existing events with reserved future portions.
2. Property tests: no hard-constraint violations; coverage monotonic vs empty; leftover accounting; fingerprint reject on mutation; grocery untouched by apply.
3. Tune pruning, eligibility caches, incremental scoring, beam width, budget, worker memory — only with benchmark evidence.
4. Optional conservative local-improvement pass: keep the original result unless the replacement is valid **and** lexicographically better.

---

## Intentionally still out of this phase

Cross-week leftover inventory; pantry/expiry; nutrition and allergen certification; LLM or cloud ranking; automatic grocery updates; collaborative sync; inferred pairings from cuisine text; user-editable raw score weights; component-level locks.
