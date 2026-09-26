# Next actions

Related: [plan](generation-plan.md) · [what shipped](generation-implemented.md) · [pull request](https://github.com/Sintexer/planeat/pull/6)

## Now

- [ ] Review [batch planning](https://github.com/Sintexer/planeat/pull/6) and mark it ready when the diff looks right.
- [ ] Wait for checks on `cursor/plan-generation-batches-5d46`.
- [ ] Click through a generated week in the app. Tests cover proposal data; the preview screen was not exercised in a browser.

## Then judge the six weeks

Use household feedback, not another algorithm pass, unless a week is wrong.

- [ ] Normal mixed catalog — quantities, grouping, variety.
- [ ] Small catalog — valid fill or clearly unfilled slots.
- [ ] Mostly busy days — reuse lands on busy days, and demanding new sides stay off them.
- [ ] No leftovers requested — zero extra uses creates no later consumption.
- [ ] Batch-heavy household — the existing higher extra-uses setting is honored.
- [ ] Partially fixed week with existing leftovers — fixed meals and reserved portions stay put.

For each week, note how many edits a household would make before accepting the plan.

## Only if feedback says the engine is not enough

- [ ] Another small decision change inside the current search. Keep the beam and the budget.
- [ ] Skip a new scheduler, a score rewrite, preparation-only events, and new settings.

## Later, when nutrition data is reliable

- [ ] Score the portion eaten in a meal, using quantities, yields, servings, and explicit components already stored.
- [ ] Leave unknown nutrition data explicit. Do not add a nutrient model before the data exists.
