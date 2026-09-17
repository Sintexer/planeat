# Functional spec

Present-tense product behavior as of Sprint 18. Remaining sequenced work lives in [`docs/sprints/plan.md`](sprints/plan.md).

## Plan

Default home. Seven-day plan for the week containing today (or a specific `planId`), with day selection, week navigation, and a month calendar picker. Week start day comes from settings. `/today` and `/week` redirect here.

Slots can be empty, filled with one or more components, or excluded (eating out). Empty and excluded must look different. Tap a slot to open the meal editor. Generate groceries from this screen (update existing vs create new).

Prep sessions and effort units, meal favorites, recipe pairings, fuzzy Suggested picker, and soft planning prompts are part of this flow.

## Meal editing and batch reuse

Each meal can have multiple components. A component is a new cooking event, a link to an existing cooking event in the same plan, or a simple food. Placing a recipe stores a snapshot so library edits do not rewrite the plan.

When adding a recipe, choose **Cook new** or **Use existing prep** (eligible events with remaining output that satisfy the recipe reuse policy). Allocations cannot exceed planned output; over-allocation offers increase output, reduce allocation, or create another cooking event. Unallocated remainder is a non-blocking warning. Fresh-only / same-day recipes cannot feed later days; batch-friendly recipes can. Removing or clearing shared prep lists every affected meal.

Grocery generation still counts each cooking event once, so a shared batch appears once on the list.

The meal picker still uses a shared catalog plus a Suggested chip; Sprint 19 is the remaining reorganization into named picker sections with separate picker filter state.

## Lists

Standalone grocery lists (open/closed). Generate from a week plan: scaled cooking-event ingredients plus simple-food allocations, aggregated only when units are compatible (`UnitRegistry`; legacy unspecified `cup`/`tbsp` do not mix with other volumes). Leftover reuse does not duplicate a cooking event. Ingredients marked “usually have at home” (`isCommon`) start checked but stay visible — this is not pantry tracking. Manual items, quantity/label edits, and checkmarks are saved on the list — plan edits do not overwrite silently; use Update existing vs Create new from Plan.

Displayed quantities follow the household measurement presentation preference without rewriting stored values. Shopping-section grouping is not shipped (Sprint 20).

## Recipes

Full recipe library (create/edit/detail, ingredient catalog, simple foods, scale preview, household tags, optional dish type / cuisine). Recipes and simple foods share catalog UI; they stay separate records. Compact cards show kind and recorded time when present.

Library search is Fuse on name/tags/subtitle. Filters live in a drawer: kind, meal occasion, meal role, effort, household tags, maximum recorded total time, contains/exclude catalog ingredients (IDs; aliases only help pick the row). Missing total time is not treated as zero. Unlinked imported ingredient lines do not satisfy contains/exclude; the drawer states this is not an allergy-safety guarantee. Sort and grouping persist in settings.

On first launch, if the recipe table is empty, the app seeds a small editable starter set. Seeding never runs once any recipe exists and never overwrites user data.

Structured import (JSON / JSON-LD / HTML with embedded JSON-LD) prefills a draft. Ambiguous cups/tablespoons/ounces stay visible for confirmation; unresolved measurements keep the original line (`sourceText`) and may be saved as-is. Ingredient matching suggests catalog rows; unique identity matches pre-link without writing aliases; ambiguous names require a choice; unlinked lines save without creating catalog rows. Adding an imported phrase as a reusable alias is a separate confirmation.

## Settings

Household size, week-start day, planning preferences, catalog sort/group, UI locale, measurement presentation (default as-entered), JSON backup export/restore (replace-all).

Locale and measurement presentation must not change stored quantities, IDs, or local calendar dates.
