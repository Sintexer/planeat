# What shipped

Draft pull request: [batch planning](https://github.com/Sintexer/planeat/pull/6) on `cursor/plan-generation-batches-5d46`.

Planning decisions changed inside the existing generation search (`algorithmVersion` 39). Same beam, same budget, same proposal and apply flow.

Related: [plan](generation-plan.md) · [next actions](generation-next.md)

## Sprint A

- Recipe yield stays a grocery scale factor. It is not a minimum cook quantity.
- Default extra consumption is one later meal (`generationBatchPolicy.maxExtraPlannedUses`). Zero still means none. The Batch cooking preset allows two.
- A new batch is the sum of the meals that will eat it, including per-slot portion overrides.
- A main that needs an accompaniment only appears with a stored pairing or favorite. Incomplete mains are not complete meals.
- Existing planned meals and grocery lists stay unchanged until Apply.

## Sprint B

- New batch variants prefer an eligible free day. Busy days still cook when no later free anchor exists.
- Later consumers try a few placements (earlier reuse, a spaced reuse, a different lunch or dinner occasion), only inside the recipe reuse policy.
- A busy-day leftover cannot hide a non-quick newly cooked side.
- If a useful later meal cannot be formed, the batch shrinks or is not created.
- Leftovers never take portions already reserved for fixed meals.

## Sprint C

- Lunch and dinner share main recency.
- A reused main prefers a different known side.
- A new cook prefers the least recently eaten eligible recipe.
- Remaining meals fill in order: compatible leftovers, simple meals or known compositions, low-effort recipes, then less-recent choices.
- The proposal carries a preparation summary (cook for / prepare / reheat) from existing events. Reusing a main still shows side preparation.

## Tests

`bun run format`, `lint`, `typecheck`, `test` (453), and `build` passed on the branch. The preview screen was not clicked through in a browser. The summary text is covered as proposal data.

| Criterion | Tests |
| --- | --- |
| Quantities match planned meals; yield is not a floor | `batches.test.ts`; `representativeWeeks.test.ts` small catalog |
| Extra uses respected | `batches.test.ts`; no-leftovers and batch-heavy weeks |
| New main prep grouped on a suitable day | mixed catalog and batch-heavy week |
| Busy days stay simpler | mostly-busy and mixed catalog |
| Identical plates are not repeated when a known alternative exists | mixed catalog |
| Meals are complete; fixed meals and existing leftovers stay reserved | mixed catalog and partially fixed week |
| Preparation summary | mixed, batch-heavy (cook-for), partial-fixed (reheat) |

## Left as-is

- No preparation-only events. A reused main can still need a side that day, and the summary says so.
- Free-day batching is a preference. A week is not forced down to three cooking sessions.
- With four dinners and two extra uses, two pairs can beat one triple plus a singleton. The third-meal case is covered on a three-dinner week.
- If the only known side is non-quick, a busy day is not a feasible consumer and the batch shrinks.
- No invented pairings and no nutrition model.
