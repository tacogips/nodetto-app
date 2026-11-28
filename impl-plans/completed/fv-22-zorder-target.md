# fv-22-zorder-target

- planId: fv-22-zorder-target
- planPath: impl-plans/active/fv-22-zorder-target.md
- progressPath: impl-plans/progress/fv-22-zorder-target.md
- wave: 5
- dependsOn: fv-11-zorder-model
- Design: sections 6.2 (`targetOrder_*`), 8.
- writePaths: `formal/Nodetto/ZOrder/TargetOrder.lean`, `formal/Nodetto/ZOrder.lean`,
  `impl-plans/progress/fv-22-zorder-target.md`, `tmp/fv-s942/fv-22-zorder-target`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove the six `targetOrder` statements: permutation, selected and unselected order
kept, front and back idempotent, selecting everything is a no-op.

## Changes

- `formal/Nodetto/ZOrder/TargetOrder.lean` (`namespace Nodetto.ZOrder`, imports the
  Model): `targetOrder_perm`, `targetOrder_selected_order`,
  `targetOrder_unselected_order`, `targetOrder_front_idem`, `targetOrder_back_idem`,
  `targetOrder_all_selected`, copied verbatim from the design.
- `formal/Nodetto/ZOrder.lean`: add `import Nodetto.ZOrder.TargetOrder`.

## Pitfalls

- Forward/backward: prove that one adjacent swap of a selected and an unselected
  element is a `Perm` and preserves both filters, then induct over the pass. Core
  has `List.Perm` lemmas (`List.perm_append_comm`, `List.filter_append`); no Mathlib.
- `front`/`back` idempotence: `filter` of `rest ++ picked` by `selected` is `picked`.

## Acceptance criteria

- The audit passes for the six names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s942/fv-22-zorder-target/build.log 2>&1`
2. `formal/scripts/audit --module ZOrder --theorem targetOrder_perm --theorem targetOrder_selected_order --theorem targetOrder_unselected_order --theorem targetOrder_front_idem --theorem targetOrder_back_idem --theorem targetOrder_all_selected > tmp/fv-s942/fv-22-zorder-target/audit.log 2>&1`
