# Functional spec

## Plan

Default home. Seven-day plan for the week containing today (or a specific `planId`), with day selection, week navigation, and a month calendar picker. Week start day comes from settings. `/today` and `/week` redirect here.

Slots can be empty, filled with one or more components, or excluded (eating out). Empty and excluded must look different. Tap a slot to open the meal editor. Generate groceries from this screen (update existing vs create new).

## Meal editing and batch reuse

Each meal can have multiple components. A component is a new cooking event, a link to an existing cooking event in the same plan, or a simple food. Placing a recipe stores a snapshot so library edits do not rewrite the plan.

When adding a recipe, choose **Cook new** or **Use existing prep** (eligible events with remaining output that satisfy the recipe reuse policy). Allocations cannot exceed planned output; over-allocation offers increase output, reduce allocation, or create another cooking event. Unallocated remainder is a non-blocking warning. Fresh-only / same-day recipes cannot feed later days; batch-friendly recipes can. Removing or clearing shared prep lists every affected meal.

Grocery generation still counts each cooking event once, so a shared batch appears once on the list.

Not in this slice originally; now shipped in Sprint 5 remainder: prep sessions / effort units, favorites, pairings, fuzzy search, soft planning prompts.

## Lists

Standalone grocery lists (open/closed). Generate from a week plan: scaled cooking-event ingredients plus simple-food allocations, aggregated only when units are compatible. Leftover reuse does not duplicate a cooking event. Ingredients marked “usually have at home” (`isCommon`) start checked but stay visible — this is not pantry tracking. Manual items, quantity/label edits, and checkmarks are saved on the list — plan edits do not overwrite silently; use Update existing vs Create new from Plan.

## Recipes

Full recipe library (create/edit/detail, ingredient catalog, simple foods checklist, scale preview). Recipes and simple foods may share a catalog UI; they stay separate records.

On first launch, if the recipe table is empty, the app seeds a small editable starter set (cutlets, soup, carbonara, sides, and a few simple foods). Seeding never runs once any recipe exists and never overwrites user data.

Structured import (JSON / JSON-LD / HTML with embedded JSON-LD) prefills a draft. Ambiguous lines stay visible; Sprint 9 adds match-and-confirm for ingredients and units without inventing precision.

## Settings

Household size, week-start day, planning preferences, JSON backup export/restore (replace-all).

Sprint 7 adds UI locale and measurement presentation preference (default as-entered). Locale must not change stored quantities, IDs, or local calendar dates. See [`docs/sprints/plan.md`](sprints/plan.md).
