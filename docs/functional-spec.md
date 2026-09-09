# Functional spec

## Today

Meals for the current local calendar day from the plan covering that week. Slots can be empty, filled with one or more components, or excluded (eating out). Tap a slot to open the meal editor.

## Week

Seven-day plan for the week containing today (or a specific `planId`), with prev/next week navigation. Same meal-editor actions as Today. Week start day comes from settings.

## Meal editing and batch reuse

Each meal can have multiple components. A component is a new cooking event, a link to an existing cooking event in the same plan, or a simple food. Placing a recipe stores a snapshot so library edits do not rewrite the plan.

When adding a recipe, choose **Cook new** or **Use existing prep** (eligible events with remaining output that satisfy the recipe reuse policy). Allocations cannot exceed planned output; over-allocation offers increase output, reduce allocation, or create another cooking event. Unallocated remainder is a non-blocking warning. Fresh-only / same-day recipes cannot feed later days; batch-friendly recipes can. Removing or clearing shared prep lists every affected meal.

Grocery generation still counts each cooking event once, so a shared batch appears once on the list.

Not in this slice: prep sessions / effort units, favorites, pairings, fuzzy search, soft planning prompts.

## Lists

Standalone grocery lists (open/closed). Generate from a week plan: scaled cooking-event ingredients plus simple-food allocations, aggregated by compatible units. Common pantry ingredients start checked but stay visible. Manual items, quantity/label edits, and checkmarks are saved on the list — plan edits do not overwrite silently; use Update existing vs Create new from the week screen.

## Recipes

Full recipe library (create/edit/detail, ingredient catalog, simple foods checklist, scale preview).

On first launch, if the recipe table is empty, the app seeds a small editable starter set (cutlets, soup, carbonara, sides, and a few simple foods). Seeding never runs once any recipe exists and never overwrites user data.

## Settings

Household size, week-start day, JSON backup export/restore (replace-all).
