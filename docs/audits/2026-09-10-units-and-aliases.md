# Unit and alias audit (2026-09-10)

Pointers (do not duplicate the identity spec):

- Ingredient identity: section A in [`../specs/2026-09-10-identity-measurement-localization.md`](../specs/2026-09-10-identity-measurement-localization.md)
- Unit semantics: section C in the same spec
- Snapshot preservation: snapshots section in the same spec

This note records **what is stored today** (`starterCatalog.ts` + `QUANTITY_UNITS`) so Sprint 8 can add a unit registry without guessing.

## Units in data

| Unit in data         | Meaning today                                                    | Sprint 8 risk                                                          |
| -------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `g`, `kg`, `ml`, `l` | Unambiguous mass/volume                                          | Keep; Sprint 7 display may convert g↔kg and ml↔l for presentation only |
| `tsp`, `tbsp`, `cup` | convert-units US aliases in `QuantityService.add` / `canConvert` | Do not guess US vs metric vs Australian on migrate                     |
| `piece`, `serving`   | Count; `serving` is not interchangeable across recipes           | Keep separate                                                          |

`QUANTITY_UNITS` is exactly: `g`, `kg`, `ml`, `l`, `tsp`, `tbsp`, `cup`, `piece`, `serving`. There is no `oz`, `clove`, or `cup_metric`.

Starter recipes use `g`, `tsp`, `tbsp`, `piece`, and `serving`. No seed line uses `cup`, `kg`, `ml`, or `l`. Carbonara garlic is stored as `1 piece`, not `clove` — culinary-count debt for Sprint 8.

## Aliases

Seed aliases (chicken breast / minced chicken, eggs, pepper, oil / vegetable oil, potatoes, pasta, guanciale / pancetta, pecorino / parmigiano, kasha, yoghurt) have **no locale**. Leave them unclassified; do not stamp a language during migration.

Ingredient **identity is the ID**. Names and aliases are metadata. Fuzzy search must not merge catalog rows.
