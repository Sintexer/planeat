# Generation plan

Product goal: cook useful batches on suitable days, reuse them without serving identical meals repeatedly, and fill the rest with simple options.

Keep the existing architecture, constraints, proposal flow, and bounded search. Change the planning decisions. Three small sprints. No general scheduling system.

Related: [what shipped](generation-implemented.md) · [next actions](generation-next.md) · [pull request](https://github.com/Sintexer/planeat/pull/6)

## Strategy

Start from the household week already in the app: selected meals, busy and free days, portions, existing meals and leftovers, restrictions, and batch preference. No new configuration system.

Prefer preparation on free days. That is a preference. Sides may still need preparation, and the catalog may require more cooking. Do not invent preparation-only events.

Cook a main for two meals by default:

1. Choose the preparation meal.
2. Find one suitable later consumption.
3. Calculate production from those two meals’ actual portions.
4. Complete each plate with a known side or composition.

Allow a third consumption only when the household’s existing setting asks for more batch reuse. Recipe yield scales the grocery quantity. It is not a mandatory minimum batch.

Make the second plate different when the catalog already allows it: a different known accompaniment, a different lunch or dinner occasion, and spacing that the recipe’s reuse policy allows. Do not invent pairings.

Fill remaining meals in this order:

1. Available compatible leftovers.
2. Eligible simple meals or known compositions.
3. Low-effort recipes.
4. Less-recently-eaten recipes when unused choices run out.

Breakfast keeps its existing separate rotation.

## Sprint A — predictable batches

The generator produces sensible quantities and respects the household’s reuse preference.

- Remove implicit yield-floor batching.
- Respect the configured maximum extra uses. Default to one extra consumption.
- Calculate production as the sum of planned consumer requirements.
- Preserve existing constraints, fixed allocations, and proposal validation.
- Incomplete mains do not count as complete meals.

Acceptance:

- Zero extra uses means no additional consumption from a newly generated batch.
- A recipe yielding 12 pieces can be scaled to a six-piece meal.
- Two meals requiring six and four pieces produce ten pieces, where existing scaling permits it.
- Every generated main that requires an accompaniment has a known compatible one.
- Existing planned meals and grocery lists stay unchanged until their explicit workflows run.

Out of scope: new persistent batch entities, minimum-batch settings, a new scoring framework.

## Sprint B — place batches where they help

New preparation favors free days. Busy days benefit from reuse.

Modify existing block placement. Keep the current search budget.

- Prefer eligible free-day preparation anchors.
- Try a small number of later allocations: earlier eligible reuse, a spaced reuse, a different lunch or dinner occasion.
- Check that required sides fit existing preparation restrictions.
- Fall back to a smaller batch when a useful later meal cannot be formed.

Acceptance:

- In a suitable fixture, cooking shifts toward free days and reuse toward busy days.
- A batch is created only when its planned consumption is feasible.
- Leftovers never consume portions reserved for fixed meals.
- Reuse respects the existing recipe policy.
- A busy-day leftover meal does not hide a demanding newly cooked side.
- When the catalog cannot support the preferred structure, the engine returns a valid alternative or clearly unfilled slots.

Out of scope: global kitchen scheduling, workload prediction, preparation-only events.

## Sprint C — less repetition, clearer result

The week feels varied, and the household can see what to cook.

- Main recency spans lunch and dinner.
- Prefer a different known side when reusing a main.
- When cooking a recipe again, prefer the least recently eaten eligible option.

Reusing a dish counts as eating it again. It does not count as cooking it again.

Expose a short preparation summary from existing event data: cook for specific days, prepare a side, reheat. Show side preparation on a day that only reuses the main.

Acceptance:

- Yesterday’s dinner counts as recent when selecting today’s lunch.
- Intentional reuse remains possible.
- Compatible side alternatives are used when they improve variety and still fit restrictions.
- With no unused suitable recipes left, an earlier-week choice is preferred over yesterday’s equivalent choice.
- Users can see new preparation versus reheating.
- Generation stays deterministic and responsive.

Out of scope: an expanded preference editor, automatic culinary compatibility, nutrition scoring.

## How to judge it

Six representative weeks, not a benchmark suite:

1. Normal mixed catalog.
2. Small catalog.
3. Mostly busy days.
4. No leftovers requested.
5. Batch-heavy household.
6. Partially fixed week with existing leftovers.

For each week: quantities, grouping of new main preparation, whether busy days are simpler, whether identical meals repeat, whether selected meals are complete and valid, and how many changes a household would make before accepting.

Household feedback decides whether another algorithm change is needed.

## Later nutrition

Keep the foundation and stop there until reliable data exists:

- Ingredient quantities.
- Recipe yields and per-meal servings.
- Explicit meal components.
- Production separate from consumption.
- Unknown data left explicit.

Nutrition would be evaluated on the portion consumed in a meal. No nutrient model and no nutrition optimization in this release.
