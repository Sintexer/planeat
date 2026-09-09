# Functional spec

## Today

Meals for the current local calendar day from the plan covering that week. Slots can be empty, filled (one recipe or simple food), or excluded (eating out). Placing a recipe stores a snapshot so library edits do not rewrite the plan.

## Week

Seven-day plan for the week containing today (or a specific `planId`), with prev/next week navigation. Same slot actions as Today. Week start day comes from settings.

## Lists

Grocery lists (Sprint 4).

## Recipes

Full recipe library (create/edit/detail, ingredient catalog, simple foods checklist, scale preview).

On first launch, if the recipe table is empty, the app seeds a small editable starter set (cutlets, soup, carbonara, sides, and a few simple foods). Seeding never runs once any recipe exists and never overwrites user data.

## Settings

Household size, week-start day, JSON backup export/restore (replace-all).
