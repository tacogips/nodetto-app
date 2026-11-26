# fv-23-zorder-relative

- planId: fv-23-zorder-relative
- planPath: impl-plans/active/fv-23-zorder-relative.md
- progressPath: impl-plans/progress/fv-23-zorder-relative.md
- wave: 6
- dependsOn: fv-22-zorder-target
- Design: sections 6.2 (`relativeOrder_*`), 8; `design-z-order.md` section 3 anchors.
- writePaths: `formal/Nodetto/ZOrder/RelativeOrder.lean`, `formal/Nodetto/ZOrder.lean`,
  `impl-plans/progress/fv-23-zorder-relative.md`, `tmp/fv-s942/fv-23-zorder-relative`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove the six `relativeOrder` statements: permutation, moved and unmoved order kept,
no-anchor no-op, and the `before`/`after` placement rule.

## Changes

- `formal/Nodetto/ZOrder/RelativeOrder.lean`: `relativeOrder_perm`,
  `relativeOrder_moved_order`, `relativeOrder_unmoved_order`,
  `relativeOrder_no_anchor`, `relativeOrder_before`, `relativeOrder_after`, verbatim.
- `formal/Nodetto/ZOrder.lean`: add `import Nodetto.ZOrder.RelativeOrder`.

## Pitfalls

- Witnesses: `pre := rest.take at`, `post := rest.drop at` with `rest` the unmoved
  filter; `at` is the first anchor position (`before`) or last + 1 (`after`).
- `rest.take at ++ rest.drop at = rest` (`List.take_append_drop`).
- `relativeOrder_no_anchor` hypothesis is about unmoved ids only; anchors that are
  moved do not count.

## Acceptance criteria

- The audit passes for the six names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s942/fv-23-zorder-relative/build.log 2>&1`
2. `formal/scripts/audit --module ZOrder --theorem relativeOrder_perm --theorem relativeOrder_moved_order --theorem relativeOrder_unmoved_order --theorem relativeOrder_no_anchor --theorem relativeOrder_before --theorem relativeOrder_after > tmp/fv-s942/fv-23-zorder-relative/audit.log 2>&1`
