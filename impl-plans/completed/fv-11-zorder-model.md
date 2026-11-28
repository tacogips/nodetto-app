# fv-11-zorder-model

- planId: fv-11-zorder-model
- planPath: impl-plans/active/fv-11-zorder-model.md
- progressPath: impl-plans/progress/fv-11-zorder-model.md
- wave: 4
- dependsOn: fv-02-audit, fv-04-stubs-a, fv-10-fractional-model
- Design: sections 3 (B1, B2), 5 (D3, D5), 6.2, 7.
- writePaths: `formal/Nodetto/ZOrder/Model.lean`, `formal/Nodetto/ZOrder/Vectors.lean`,
  `formal/Nodetto/ZOrder.lean`, `formal/vectors/z-order.json`,
  `impl-plans/progress/fv-11-zorder-model.md`, `tmp/fv-s942/fv-11-zorder-model`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Model of `packages/core/src/z-order.ts` `relativeOrder`, `targetOrder`,
`reorderCommands` (with the D3 duplicate refusal), plus `applyReorders` and `keyOf`.

## Changes

- `formal/Nodetto/ZOrder/Model.lean`, `namespace Nodetto.ZOrder`, imports
  `Nodetto.Fractional.Model` (not the Fractional root). Exactly the design 6.2
  signatures and the binding definitions of `targetIds` and `keyOf`;
  `abbrev ElemId := String` (E-encoded, B1).
  - `targetOrder`: `front`/`back` via filters; `forward` is the top-down pass with
    adjacent swaps from index `len-2` to `0`, `backward` the bottom-up pass from 1;
    a swap at `at` exchanges positions `at` and `at+1` of the working list.
  - `relativeOrder`: `picked`, `rest`, anchor positions in `rest`, `at` = first
    position (`before`) or last + 1 (`after`); unchanged list when no position.
  - `reorderCommands`: `target := targetIds`; return `.ok ([], rng)` when the length
    differs from `elements.length` or `target` has a duplicate (D3), or when ids
    equal `target` (`sameOrder`); usable = all keys fractional and pairwise
    distinct, else `renumber`; then the `highestKept` pass and the `keyBetween`
    pass (below = final key of the previous target id, above = original key of the
    next kept id), with the `renumber` fallback when `below >= above`.
  - `renumber`: chain of `keyAfter` starting from `none`. The in-loop `renumber`
    fallback starts from the rng state left by the earlier `keyBetween` draws (the TS
    closure has already consumed them), not from the initial draw list.
- `formal/Nodetto/ZOrder.lean`: `import Nodetto.ZOrder.Model`.
- `formal/Nodetto/ZOrder/Vectors.lean`: module `"z-order"`, sources
  `["packages/core/src/z-order.ts","packages/core/src/fractional.ts"]`. Cases:
  `targetOrder {ordered, selected, action}`, `relativeOrder {ordered, moved,
  anchorBlock, side}`, `reorderCommands {elements:[[id,key]], order, draws}` ->
  `ok [[id,key],...]` or `err "range"`. Ids are written with `Nodetto.Json.ofE` of the
  E-encoded id (use ASCII ids in generation, E-encoded in the model). Include: empty
  list, all selected, none selected, blocks at both ends, anchors inside `moved`,
  duplicate ids in `order` (`[a,a]`), unknown ids in `order`, unchanged order,
  foreign keys (`zz!`, ties) to force `renumber`, and keys with shared prefixes.
- `formal/vectors/z-order.json`: generated, committed.

## Pitfalls

- `selected`/`moved`/`anchorBlock` are predicates `ElemId → Bool`; in vectors they are
  lists and the generator uses `fun id => list.contains id`.
- The model must mirror the fixed code (D3) even though the TS fix lands in fv-41;
  fv-41 depends on this plan and its test will fail until its own fix is in.
- Key comparison is `List.lt` on code units, as in fractional.

## Acceptance criteria

- [x] `Nodetto.ZOrder` builds; vectors are fresh with 200+ cases, 20+ per fn.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s942/fv-11-zorder-model/build.log 2>&1`
2. `formal/scripts/audit --module ZOrder --vectors > tmp/fv-s942/fv-11-zorder-model/audit.log 2>&1`
