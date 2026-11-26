# fv-24-zorder-reorder

> Superseded in finishing run fv-s959 (2026-11-27) by the chain fv-24a-reorder-scan,
> fv-24b-reorder-loop-eqs, fv-24c-reorder-invariant, fv-24d-reorder-steps,
> fv-24e-reorder-loop and fv-24f-reorder-spec (design 6.2.1). This plan is no
> longer dispatched. `reorderCommands_refuses` and `reorderCommands_unchanged`
> are done; fv-24f completes `reorderCommands_spec`.

- planId: fv-24-zorder-reorder
- planPath: impl-plans/active/fv-24-zorder-reorder.md
- progressPath: impl-plans/progress/fv-24-zorder-reorder.md
- wave: 7
- dependsOn: fv-21-fractional-keys, fv-23-zorder-relative
- Design: sections 5 (D3, D5), 6.2 (`reorderCommands_*`), 8.
- writePaths: `formal/Nodetto/ZOrder/Reorder.lean`, `formal/Nodetto/ZOrder.lean`,
  `impl-plans/progress/fv-24-zorder-reorder.md`, `tmp/fv-s942/fv-24-zorder-reorder`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove `reorderCommands_refuses`, `reorderCommands_unchanged` and
`reorderCommands_spec`: after the emitted rewrites, keys strictly increase along the
target order and untouched elements keep their keys.

## Changes

- `formal/Nodetto/ZOrder/Reorder.lean` (imports `Nodetto.ZOrder.Model` and the
  `Nodetto.Fractional` root for `keyBetween_*`/`keyAfter_*`): the three theorems,
  verbatim.
- `formal/Nodetto/ZOrder.lean`: add `import Nodetto.ZOrder.Reorder`.

## Pitfalls

- Refusal: `¬ Perm` with `targetIds ⊆ ids` implies a length mismatch or a duplicate
  (counting argument via `List.Nodup`/`List.Perm` lemmas).
- `renumber` gives a strictly increasing chain by `keyAfter_gt`; it never errors.
- Non-renumber path invariant: kept keys strictly increase along the target; each
  moved key lies between `below` (previous final key) and `above` (next kept key) by
  `keyBetween_between/below/above/unbounded`; therefore the in-loop renumber fallback
  never fires, but the proof must still handle the branch (it yields the renumber
  result, which also satisfies the conclusion).
- Each id gets at most one command because `targetIds` is duplicate-free there.

## Acceptance criteria

- The audit passes for the three names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s942/fv-24-zorder-reorder/build.log 2>&1`
2. `formal/scripts/audit --module ZOrder --theorem reorderCommands_refuses --theorem reorderCommands_unchanged --theorem reorderCommands_spec > tmp/fv-s942/fv-24-zorder-reorder/audit.log 2>&1`
