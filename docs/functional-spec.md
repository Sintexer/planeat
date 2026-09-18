# Functional spec

Present-tense product behavior as of Sprint 28. Remaining sequenced work is Phase 7 (automatic meal planning) in [`docs/sprints/generation.md`](sprints/generation.md); Status in [`docs/sprints/plan.md`](sprints/plan.md).

## Plan

Default home. Seven-day plan for the week containing today (or a specific `planId`), with day selection, week navigation, and a month calendar picker. Week start day comes from settings. `/today` and `/week` redirect here.

Slots can be empty, filled with one or more components, or excluded (eating out). Empty and excluded must look different. Tap a slot to open the meal editor. An empty, non-excluded day slot can **Generate** a single newly cooked complete recipe for that occasion: preview scaled portions, then Apply (same cook-new write as the meal editor) or Cancel (nothing persisted). Filled and excluded slots cannot be overwritten. Generate groceries from this screen; if an open list is already linked, inspect the update preview (or create a new list) before any overwrite. Plan changes never update grocery lists automatically.

Prep sessions and effort units, meal favorites, recipe pairings, fuzzy Suggested picker, and soft planning prompts are part of this flow.

## Meal editing and batch reuse

Each meal can have multiple components. A component is a new cooking event, a link to an existing cooking event in the same plan, or a simple food. Placing a recipe stores a snapshot so library edits do not rewrite the plan.

When adding a recipe, choose **Cook new** or **Use existing prep** (eligible events with remaining output that satisfy the recipe reuse policy). Allocations cannot exceed planned output; over-allocation offers increase output, reduce allocation, or create another cooking event. Unallocated remainder is a non-blocking warning. Fresh-only / same-day recipes cannot feed later days; batch-friendly recipes can. Removing or clearing shared prep lists every affected meal.

Grocery generation still counts each cooking event once, so a shared batch appears once on the list.

The meal picker groups leftovers, pairings, favorites, suitable recipes, and All items. Search and filters reuse the library catalog controls, but picker browse state (query, filters, sort) is local to Add dish and resets when the modal closes — it does not read or write the Recipes library settings. Slot meal type may rank suggestions; All items is not silently occasion-filtered. Rows show a short explanation when a leftover batch date, pairing partner, favorite, or already-planned-this-week signal is present.

## Lists

Standalone grocery lists (open/closed). Generate from a week plan: scaled **live** library recipe ingredients (snapshot if the recipe is gone) plus simple-food allocations, aggregated when units are compatible. Same unit stays that unit; mixed convertible volumes total in milliliters. Culinary spoons (`tsp`, `tbsp`) stay spoons unless mixed with another volume type. Legacy unspecified `cup` does not mix with other volumes. Leftover reuse does not duplicate a cooking event. Generated lines keep a **Used by** breakdown of contributing meals (captured at generate/update time). Expand a generated row to see each dish and amount; leftover slots share one cooking-event contribution. A still-present meal links to that day on Plan. Manual items stay unmarked as plan sources. Ingredients marked “usually have at home” (`isCommon`) start checked but stay visible — this is not pantry tracking. Manual items, quantity/label edits, and checkmarks are saved on the list. Plan edits never mutate a list until the cook confirms **Update from plan**. The preview lists added requirements, quantity changes, lines no longer required, and generated quantities the shopper edited (default **Keep my quantity**, or **Use planned quantity**). Convert-equal amounts (for example 1 kg and 1000 g) are not treated as changes. A checked line whose stored amount will increase is unchecked so the extra is not treated as already handled. Manual items remain. **Cancel** writes nothing; **Create new** leaves the existing list as-is. Matching generated rows keep their ids, check state (unless unchecked for an increase), shopping section, and label. The same catalog ingredient is one shopping row: a known amount absorbs unspecified contributions from other meals; grams and pieces stay separate checkable amounts under that name.

Displayed quantities follow the household measurement presentation preference without rewriting stored values. Lists can be shown grouped by shopping section (produce, bakery, chilled, pantry, frozen, other) or flat. Items without a section appear under Other. Checking an item does not reorder the list; a hide-checked toggle filters already-checked rows. Catalog ingredients can store an optional shopping section that new generated lines inherit. Manual lines can pick a section. This is not store-aisle mapping or pantry tracking.

## Recipes

Full recipe library (create/edit/detail, ingredient catalog, simple foods, scale preview, household tags, optional dish type / cuisine). Recipes and simple foods share catalog UI; they stay separate records. Library rows are divider list items: kind, recorded time when present, meal-role chips, and household tags.

Library search is Fuse on name/tags/subtitle. Filters live in a drawer: kind, meal occasion, meal role, effort, household tags, maximum recorded total time, contains/exclude catalog ingredients (IDs; aliases only help pick the row). Missing total time is not treated as zero. Unlinked imported ingredient lines do not satisfy contains/exclude; the drawer states this is not an allergy-safety guarantee. Sort and grouping persist in settings. Named saved views store the current query, filters, sort, grouping, and optional cleanup kind; restoring a view re-runs it against the live catalog. Changing browse state never silently overwrites a view — use Update view or Save as new. Deleted tag/ingredient filter ids stay visible to clear; they are skipped while matching so the library is not emptied. Archived tags still filter by live assignments.

Optional **Cleanup** views (opened as **Find gaps** on the Recipes library) list items missing meal occasion, dish type, recorded total time, or unlinked ingredient lines. These are maintenance tools: missing optional metadata is not an error, and the main library does not warn on every incomplete card. Recipe-only gaps (dish type, time, unlinked lines) do not list simple foods. Cleanup can be saved on a named view; backups treat an omitted cleanup field as none.

The Recipes library has an explicit **Select** mode for bulk tagging. Select visible items (or tap rows), then add tags (create-or-link like the editor) or remove a tag that appears on the selection. Apply is transactional across the selected recipes and simple foods; cancel writes nothing. Selection is session-only and is not part of saved views. The Add-dish picker does not use this mode. Cooking-event snapshots keep frozen historical label strings.

Household tags can be renamed, archived, merged, or deleted from `/recipes/tags`. Merge collapses duplicate live assignments; delete removes the tag only (recipes and simple foods stay) after confirming affected-item counts. Archived tags stay on assigned items and remain recoverable from tag management, but they are omitted from create autocomplete and default filter facets. Applied filters and chips still work if a tag is archived or missing. Cooking-event snapshots keep frozen historical label strings.

On first launch, if the recipe table is empty, the app seeds a small editable starter set. Seeding never runs once any recipe exists and never overwrites user data.

Structured import (JSON / JSON-LD / HTML with embedded JSON-LD) prefills a draft. Ambiguous cups/tablespoons/ounces stay visible for confirmation; unresolved measurements keep the original line (`sourceText`) and may be saved as-is. Ingredient matching suggests catalog rows; unique identity matches pre-link without writing aliases; ambiguous names require a choice; unlinked lines save without creating catalog rows. Adding an imported phrase as a reusable alias is a separate confirmation.

## Settings

Household size, week-start day, planning preferences, catalog sort/group, UI locale (English or Russian), measurement presentation (default as-entered), JSON backup export/restore (replace-all after a validated preflight: counts, optional export date, export current data first), including saved library views. An invalid or unsupported backup leaves existing household data untouched.

Locale and measurement presentation must not change stored quantities, IDs, or local calendar dates. User-authored recipe, tag, simple-food, grocery-line, and cooking-event snapshot text stays as stored. Controlled vocabulary (meal types, shopping sections, units) follows the interface language.
