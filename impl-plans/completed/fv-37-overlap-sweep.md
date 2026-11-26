# fv-37-overlap-sweep

- planId: fv-37-overlap-sweep
- planPath: impl-plans/active/fv-37-overlap-sweep.md
- progressPath: impl-plans/progress/fv-37-overlap-sweep.md
- wave: 4
- dependsOn: fv-17-overlap-model
- Design: sections 6.8, 8.
- writePaths: `formal/Nodetto/Overlap/Sweep.lean`, `formal/Nodetto/Overlap.lean`,
  `impl-plans/progress/fv-37-overlap-sweep.md`, `tmp/fv-s942/fv-37-overlap-sweep`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove that the sweep branch visits exactly the overlapping unordered pairs, once each.

## Changes

- `formal/Nodetto/Overlap/Sweep.lean`: `sweep_visits_overlaps`,
  `overlappingPairs_sweep`, verbatim.
- `formal/Nodetto/Overlap.lean`: add `import Nodetto.Overlap.Sweep`.

## Pitfalls

- Sorted-list lemma: the sort output is a permutation of the indexed items and is
  sorted by `(min, index)`; then for item `a` the scan visits exactly the later
  items with `min <= a.max` (sorted mins), and overlap implies that condition.
- Both sides are lists of distinct `(i, j)` with `i < j` after `norm`; prove `Perm`
  via `Nodup` plus equal membership (`List.perm_ext_iff_of_nodup` or a local lemma).
- No well-formedness hypothesis: degenerate boxes must be covered.

## Acceptance criteria

- The audit passes for the two names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Overlap > ../tmp/fv-s942/fv-37-overlap-sweep/build.log 2>&1`
2. `formal/scripts/audit --module Overlap --theorem sweep_visits_overlaps --theorem overlappingPairs_sweep > tmp/fv-s942/fv-37-overlap-sweep/audit.log 2>&1`
