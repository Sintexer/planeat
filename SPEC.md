Implementation status (what is shipped, what to build next) is in [`docs/sprints/plan.md`](docs/sprints/plan.md) (Status section) and [`docs/roadmap.md`](docs/roadmap.md). Phase 7 automatic-planning cards are in [`docs/sprints/generation.md`](docs/sprints/generation.md). This file is the original product-rules document, not a live sprint board.

We have enough decisions to draft the MVP.

**The main scope change for the first version was an offline, manual meal planner—not an automatic weekly planner.** It established recipes, component meals, batch preparation, and grocery lists. Automatic generation is now sequenced as Phase 7 (Sprints 28–38), using that same model: proposals only, existing cooking-event writes, no backend or LLM.

# 1. MVP definition

> An Android-friendly, offline-first web app for planning seven days of breakfasts, lunches, and dinners for two people, using personal or imported recipes, reusable prepared components, and editable grocery lists.

### Included

- Installable PWA, usable offline after initial installation.
- Local data on one device; desktop browser for development.
- Manual recipe entry.
- Import from supported structured recipe formats.
- Simple foods without full recipes.
- Manual seven-day meal planning.
- Multi-component meals and favorite combinations.
- Planned batch cooking and reuse within the current plan.
- Recipe-specific reuse and freezer-friendly metadata.
- Lightweight compatibility suggestions and warnings.
- Independent, editable grocery-list objects.
- JSON backup and restore.

### Explicitly excluded from the original MVP

- Automatic weekly generation. _(Sequenced later as Phase 7; still excluded from the manual-planner MVP definition.)_
- Backend, accounts, and device synchronization.
- Pantry inventory, expiry dates, and “use soon.”
- Actual cooking, consumption, or remaining-food tracking.
- Batch reuse across separate plans.
- Nutrition calculations and dietary optimization.
- Universal paste-a-URL extraction.
- Automated tests or a test-infrastructure sprint. _(Original MVP exclusion; Vitest is in use from Sprint 8.)_

**Excluded product features will be retained in the roadmap, not discarded.**

---

# 2. Product rules

## 2.1 Recipes and simple foods

A **recipe** describes how to produce food. It can act as a complete dish, main, side, vegetable accompaniment, breakfast component, or several of those roles.

Required fields:

| Field        | Example                       |
| ------------ | ----------------------------- |
| Name         | Chicken cutlets               |
| Yield        | 12 pieces                     |
| Ingredients  | Chicken 600 g, onion 1 piece… |
| Meal types   | Lunch, dinner                 |
| Roles        | Main                          |
| Reuse policy | Batch-friendly                |

Additional fields:

- Instructions.
- Active and total time.
- Effort classification: quick, regular, demanding.
- Source URL.
- Cuisine and compatibility tags.
- Default quantity per person.
- Maximum preferred repeated meals.
- Freezer-friendly flag.
- Optional freezing/reheating notes.

**Freezer-friendly is metadata in MVP.** It does not create freezer inventory or automatically establish safe storage durations.

A **simple food** is an ingredient served directly, such as bread, yogurt, or a banana. It needs a default serving quantity but no cooking instructions.

Users can enable or disable simple foods in an **“Include in meal suggestions”** checklist.

Disabling yogurt here means:

- Do not suggest yogurt on its own.
- Do not remove yogurt as an ingredient from recipes.
- Existing manually planned meals remain unchanged.

Recipe editing must not silently change previously saved plans or grocery lists. Planned cooking will retain a recipe snapshot.

---

## 2.2 Recipe imports: JSON-LD first

The format you heard about is probably **JSON-LD**, commonly using the Schema.org `Recipe` structure embedded in recipe websites.

### MVP import methods

- Paste a JSON-LD recipe.
- Upload a `.json` or `.jsonld` file containing supported recipe data.
- Restore recipes through the app’s own backup format.

The importer should recognize:

- A single `Recipe` object.
- Recipes inside an array or `@graph`.
- Multiple recipes, allowing the user to select which to import.

### Confirmation screen

Extract what is available:

- Name.
- Ingredients.
- Yield.
- Instructions.
- Preparation/cooking durations.
- Source information.

Then ask the user to confirm or supply:

- Structured quantities and units.
- Meal roles.
- Suitable meal types.
- Reuse policy.
- Effort classification.

Schema.org ingredient lines are often plain strings, so **valid JSON-LD does not guarantee perfectly structured ingredient quantities**.

Ambiguous lines must remain visible for correction, not be silently dropped or guessed. Do not invent numeric precision (e.g. collapsing “1–2 onions” to 1, 2, or 0) or a cup convention the source did not specify. Preserve original text; confirmation may leave lines unresolved.

### URL limitation

A URL can be saved as source attribution, but **pasting a URL alone will not import arbitrary websites in this MVP**. JSON-LD solves the data-format problem, not browser cross-origin restrictions.

All confirmed recipe text is stored locally. Reading cooking instructions must not require opening the source website.

---

## 2.3 Seven-day plans

A plan contains:

- Start date.
- Seven consecutive days.
- Breakfast, lunch, and dinner slots.
- Two people by default.
- Plan-specific preparation preferences.

Settings:

- Preferred week-start day.
- Reusable weekly meal-slot structure.
- Preferred batch-preparation days.
- Quick-meals-only days.
- Avoid multiple demanding preparations on one day.
- Maximum batch-preparation effort units.

**Exclusions belong to an individual plan and do not repeat.**

Users can:

- Add, edit, or remove meals.
- Mark a slot as excluded/eating out.
- Add multiple dishes to a meal.
- Move a meal.
- Copy a meal.
- Save an assembled meal as a favorite.
- Insert a favorite into another slot.

An empty slot and an explicitly excluded slot must look different.

---

## 2.4 Cooking and eating are separate

Even without inventory tracking, this separation remains essential.

```text
Cooking event
  Make 12 cutlets on Monday

Meal allocations
  Monday dinner:    4 cutlets + rice
  Tuesday dinner:   4 cutlets + buckwheat
  Wednesday dinner: 4 cutlets + potatoes
```

The grocery list includes ingredients for **one production of 12 cutlets**, not three productions.

Each meal component comes from one of:

1. A new cooking event.
2. An existing cooking event within this plan.
3. A simple food served directly.

A batch is therefore a **planned output**, not a claim about food currently in the refrigerator.

### Batch rules

- Fresh-only recipes cannot be allocated as later leftovers.
- Allocations cannot exceed planned output.
- A meal cannot use a batch before its scheduled preparation.
- Batch reuse stays inside its plan.
- Unallocated planned portions are shown as a warning.
- Storage safety is not inferred or guaranteed by the app.

### Preparation-session effort

Proposed interpretation of your “two dishes count as 1.5” rule:

```text
One batch dish in a session:   1.0 unit
Two batch dishes:             1.5 units
Three batch dishes:           2.0 units
Each additional batch dish:  +0.5 units
```

This is a workload heuristic, not a time estimate.

The weekly setting becomes **“Maximum batch-prep units”**, allowing half-unit increments. We can change the formula later without changing meal allocation logic.

---

## 2.5 Compatibility, variety, and vegetables

No automatic weekly generation in MVP. However, when choosing a component, the app can provide a small **“Suggested”** section.

Suggestion priority:

1. Explicitly approved pairings.
2. Saved favorite combinations.
3. Compatible roles and simple tags.
4. Relevant variety and vegetable preferences.

Users can switch to **“All recipes”** whenever needed.

### Initial preferences

| Situation                                  | Behavior                                  |
| ------------------------------------------ | ----------------------------------------- |
| Same breakfast repeated within the plan    | Strong warning / lower suggestion ranking |
| Same soup for three lunches                | Acceptable                                |
| Same main with different sides             | Acceptable                                |
| Identical dinner on consecutive days       | Warning / lower ranking                   |
| Recipe used in the previous week           | Prefer alternatives where available       |
| Multiple demanding preparations on one day | Warning                                   |
| Non-quick preparation on a quick-only day  | Warning                                   |

These are preferences for manual planning, not save-blocking rules. Quantity and source-dependency errors remain distinct validation problems.

### Vegetables

Replace the salad requirement with:

- A `vegetable accompaniment` role.
- A tag indicating that a dish provides a meaningful vegetable component.
- An optional **“Favor vegetables daily”** preference.

When enabled, a day without a tagged vegetable component gets a gentle “Add vegetables?” suggestion. This is a user-defined planning aid, not a nutritional assessment.

---

## 2.6 Editing dependent meals

When deleting or moving preparation used by several meals, show the affected meals.

```text
This preparation supplies:
• Monday dinner
• Tuesday dinner
• Wednesday dinner

[Move preparation]
[Replace/remove affected components]
[Cancel]
```

Changing a side affects only that meal.

Increasing an allocation beyond available planned output should offer:

- Increase cooking quantity.
- Reduce this allocation.
- Create another cooking event.

Do not silently modify several meals or introduce duplicate batches.

---

# 3. Grocery lists are independent objects

This is more than a view derived from the current plan.

A grocery list has:

- Name.
- Creation date.
- Open or closed status.
- Optional source plan and plan revision.
- Editable items.
- Completion/cross-out state.

Users can maintain several lists and create standalone lists unrelated to meal plans.

## 3.1 Generation

When generating from a plan:

1. Sum ingredients from cooking events.
2. Add simple foods served directly.
3. Scale recipe quantities to planned output.
4. Merge matching ingredients only when identity, purchasing form, dimension, and a known unit conversion all agree. Leave incompatible amounts as separate lines (optionally grouped under one ingredient).
5. Create a saved grocery-list object.

No pantry subtraction and no package-size rounding.

For ingredients with unknown quantities, retain the item with “quantity unspecified” or its original text. Never interpret missing quantity as zero.

## 3.2 Common ingredients (“usually at home”)

Users maintain a configurable set of ingredients they usually have at home, such as:

- Salt.
- Pepper.
- Cooking oil.

Generated items from that set appear **already crossed out**, but remain visible.

The user can uncheck them when they need to buy them.

This flag is **not** proof that the ingredient is in the house and is **not** pantry tracking. Wording should stay in that register (e.g. “Usually have at home — starts checked on new grocery lists”).

A checked item means **“handled / not needed on this trip,”** not necessarily “purchased.” The app does not update inventory.

## 3.3 Editing

Users can:

- Change quantities and units.
- Change item labels.
- Add arbitrary items.
- Delete items.
- Check/uncheck items.
- Close and reopen a list.

An arbitrary item does not need to become a canonical ingredient. “Dish soap” can simply be a list entry.

## 3.4 Regeneration

Changing a plan does not silently mutate its grocery list.

Instead:

```text
This plan has changed.

[Update existing list]
[Create a new list]
```

Updating an existing list should:

- Preserve unchanged items and their checked states.
- Flag new or increased requirements.
- Preserve manually added items.
- Ask before overwriting manually edited quantities.
- Preview removals for ingredients no longer required.

Closed lists remain unchanged by default; generate a new list instead.

---

# 4. Screen sketches

## Today

```text
┌ Today — Tuesday ───────────────┐
│ Breakfast                     │
│ Omelet + toast                │
│                               │
│ Lunch                         │
│ Soup · from Monday prep       │
│                               │
│ Dinner                        │
│ Cutlets + buckwheat            │
│                               │
│ Preparation today             │
│ Buckwheat · Quick              │
│                               │
│ + Add vegetables              │
└───────────────────────────────┘
  Today   Week   Lists   Recipes
```

No cooked/eaten checkboxes in MVP.

## Week

```text
┌ Week: 12–18 May ───────────────┐
│ [Preferences] [Groceries]      │
│                               │
│ MONDAY                        │
│ Breakfast  [+ Add]            │
│ Lunch      Soup               │
│ Dinner     Cutlets + rice     │
│ Prep       Soup, cutlets · 1.5 │
│                               │
│ TUESDAY                       │
│ Breakfast  Omelet + toast     │
│ Lunch      Soup ↳ Monday      │
│ Dinner     Cutlets + buckwheat │
│                               │
│ FRIDAY                        │
│ Dinner     Eating out         │
└───────────────────────────────┘
```

Use day cards on mobile; a wider calendar can be a desktop enhancement.

## Meal editor

```text
┌ Tuesday dinner ───────────────┐
│ Main                          │
│ Cutlets: 4 pieces              │
│ Source: Monday preparation    │
│                               │
│ Side                          │
│ Buckwheat: 2 servings          │
│ Source: Cook for this meal     │
│                               │
│ [+ Component]                 │
│ [Save as favorite]            │
│                               │
│ [Exclude meal]       [Save]    │
└───────────────────────────────┘
```

## Grocery list

```text
┌ Week of 12 May · Open ─────────┐
│ Vegetables                    │
│ ☐ Tomatoes          600 g      │
│ ☐ Onions              3       │
│                               │
│ Other                         │
│ ☐ Dish soap            1      │
│ ☑ Salt              10 g      │
│   Common ingredient           │
│                               │
│ [+ Item]       [Close list]    │
└───────────────────────────────┘
```

Quantity and label fields become editable on tap.

---

# 5. Architecture

## Stack

- React + TypeScript.
- Vite.
- IndexedDB through Dexie.
- PWA service worker.
- Static hosting.
- No runtime backend or paid service.
- No automated test tooling for MVP.

Supportive libraries beyond this core stack (Mantine modals, quantity/search/import helpers, dev tooling) are tracked in `docs/architecture.md`'s "Supportive libraries" section and `AGENTS.md`'s "Libraries" table, each tied to the sprint that introduces it — not duplicated here to avoid the two going out of sync.

Use explicit layers, but keep the application a single codebase.

```text
src/
  domain/
    recipes/
    meals/
    preparation/
    groceries/
    preferences/

  application/
    recipes/
    planning/
    groceries/
    backup/

  infrastructure/
    database/
    importers/
    offline/

  ui/
    screens/
    components/
    hooks/
```

### Responsibilities

**Domain**

- Quantities and scaling.
- Batch allocations.
- Compatibility rules.
- Grocery aggregation.
- Validation.

No React or Dexie dependencies.

**Application**

- “Add meal component.”
- “Move preparation.”
- “Generate grocery list.”
- “Update grocery list.”
- Coordinates domain operations and persistence.

**Infrastructure**

- Dexie tables and migrations.
- JSON-LD parsing.
- Backup files.
- Service worker setup.

**UI**

- Screens, forms, feedback, navigation.
- Does not contain ingredient arithmetic.

### Offline contract

After the initial successful installation/load:

- All core screens work in airplane mode.
- All saved recipe text is available.
- All writes go to local storage.
- UI fonts/icons do not depend on external CDNs.
- Application updates do not discard user data.

Request persistent browser storage where supported, but do not present it as guaranteed. Manual backup remains important because browser data can be cleared or lost.

---

# 6. Draft data schema

Use explicit quantities. `unit` is not a display preference; Sprint 12 introduces a bundled registry so `cup` is not implicitly one country’s cup.

```ts
type Quantity = {
  value: number
  unit: string // registry id or legacy string; g, ml, piece, recipe-serving, etc.
}
```

Only perform conversions that are known. A recipe-specific serving must not be treated as interchangeable with another recipe’s serving.

| Table            | Important fields                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingredients`    | Stable `id`; names/aliases are metadata (later locale-scoped); common-item flag is “usually at home”, not pantry                                   |
| `simpleFoods`    | `id`, ingredient ID, default portion, roles, tags, enabled                                                                                         |
| `recipes`        | `id`, name, yield, default portion, ingredient lines, instructions, roles, meal types, effort, times, reuse policy, freezer-friendly, tags, source |
| `recipePairings` | recipe ID, compatible recipe/simple-food ID, relationship                                                                                          |
| `mealFavorites`  | `id`, name, component definitions and quantities                                                                                                   |
| `plans`          | `id`, start date, day count, people count, preferences, revision                                                                                   |
| `mealSlots`      | `id`, plan ID, date, meal type, excluded flag, note                                                                                                |
| `mealComponents` | `id`, slot ID, source reference, allocated quantity, role                                                                                          |
| `prepSessions`   | `id`, plan ID, date, optional time/label                                                                                                           |
| `cookingEvents`  | `id`, plan ID, session ID, recipe ID, recipe snapshot, output quantity, scheduled preparation                                                      |
| `groceryLists`   | `id`, title, status, source plan ID/revision, timestamps                                                                                           |
| `groceryItems`   | `id`, list ID, label, ingredient ID if known, quantity/text, checked, origin, manual-edit metadata                                                 |
| `settings`       | week start, planning prefs, `uiLocale`, measurement presentation preference (default as-entered)                                                   |

### Meal component source

```ts
type ComponentSource =
  | {
      type: 'cooking-event'
      cookingEventId: string
    }
  | {
      type: 'simple-food'
      simpleFoodId: string
    }
```

A fresh dish and a reused batch use the same source model. The difference is whether one cooking event supplies one meal or several.

### Grocery item provenance

Store enough information to distinguish:

- Generated requirement.
- User-edited quantity.
- Manually added item.
- Automatically prechecked common ingredient.
- Explicit user check/uncheck.

This is necessary for safe list updates.

Historical cooking-event snapshots must stay self-contained for the plan (what was cooked). Grocery generate/update uses the **live library recipe** when it still exists, scaled to the cooking event's output; fall back to the snapshot if the recipe is gone.

### Backup format

```ts
type BackupFile = {
  format: 'family-menu-planner'
  schemaVersion: number
  exportedAt: string
  data: {
    // Local tables
  }
}
```

For MVP, restore can **replace all local data after a validated preflight confirmation**. Merge-importing two household databases is a separate future feature.

---

# 7. Feature-specific sprint plan

Moved to [`docs/sprints/plan.md`](docs/sprints/plan.md).

Upcoming sprints (automatic meal planning) are in [`docs/sprints/generation.md`](docs/sprints/generation.md). Status of shipped work is in [`docs/sprints/plan.md`](docs/sprints/plan.md). Evolve the existing app; do not rebuild it.

---

# 8. Deferred roadmap

| Feature                              | Foundation already provided                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Automatic weekly generation          | Phase 7: roles, preferences, cooking events, allocations (`docs/sprints/generation.md`) |
| Actual cooked/eaten tracking         | Separate cooking events and meal components                                             |
| Refrigerator/freezer inventory       | Planned output can later be distinguished from actual batches                           |
| Cross-week leftovers                 | Explicit batch references                                                               |
| Nutrition and individual portions    | Quantified yields and component allocations                                             |
| Diet/allergen constraints            | Canonical ingredients and recipe metadata                                               |
| Novelty/untried-recipe limits        | Recipe history and tags                                                                 |
| Reliable URL importing               | Separate importer interface                                                             |
| Cross-device synchronization         | Stable IDs and repository boundary                                                      |
| Pantry subtraction and package sizes | Ingredient catalog and grocery-generation service                                       |
| Nutrition databases (USDA, etc.)     | Quantified yields; no runtime food-DB in Sprints 7–9                                    |
| Barcodes / Open Food Facts           | Packaged-product identity is not required yet                                           |
| FoodOn / general food ontology       | Small app-owned vocabularies are enough                                                 |
| Photos as portable blobs             | Optional `photoUrl` only; bytes not in backups                                          |
| Recipe-library coverage research     | Meal types, roles, and reusable combinations                                            |

## Two provisional details

I would proceed with these assumptions unless you change them:

1. **Batch-session cost:** `1 + 0.5 × additional batch dishes`.
2. **Quick-meal classification:** an explicit recipe effort tag initially, rather than a mandatory minute threshold.

The next step should be to turn this into repository documents—`functional-spec.md`, `data-model.md`, and one task file per sprint—before researching the starter recipe collection.
