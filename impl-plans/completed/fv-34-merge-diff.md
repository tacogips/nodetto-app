# fv-34-merge-diff

- planId: fv-34-merge-diff
- planPath: impl-plans/active/fv-34-merge-diff.md
- progressPath: impl-plans/progress/fv-34-merge-diff.md
- wave: 5
- dependsOn: fv-33-merge-canon
- Design: section 6.7 (`getPath`, `diffPaths`, `FieldConflict`).
- writePaths: `formal/Nodetto/Merge/Diff.lean`, `formal/Nodetto/Merge.lean`,
  `impl-plans/progress/fv-34-merge-diff.md`, `tmp/fv-s942/fv-34-merge-diff`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Lemma layer 2 of 4: properties of `diffPaths` and `getPath` needed for
`mergeValue_conflict_iff` and `mergeById_conflict_iff`.

## Changes

- `formal/Nodetto/Merge/Diff.lean` with lemmas:
  - `diffPaths b x = []` iff `same b x = true`.
  - Prefix-free: no element of `diffPaths b x` is a strict prefix of another one.
  - Respects `same`: `same x y = true` implies `p ∈ diffPaths b x ↔ p ∈ diffPaths b y`,
    and `same (getPath x p) (getPath y p) = true`.
  - Object step: for objects `b`, `x` that are not `same`, `p ∈ diffPaths b x` iff
    `p = k :: p'` with `p' ∈ diffPaths (lookupFirst b k) (lookupFirst x k)`.
  - Non-object step: when not both objects and not `same`, `diffPaths b x = [[]]`.
  - `FieldConflict` is symmetric in its last two arguments.
- `formal/Nodetto/Merge.lean`: add `import Nodetto.Merge.Diff`.

## Pitfalls

- Membership, not list equality: key order in `keysUnion` differs between
  `same`-equal objects.

## Acceptance criteria

- [x] `Nodetto.Merge` builds; vectors unchanged (implementation gates:
  `tmp/fv-s942/fv-34-merge-diff/cont2-build7.log` and `cont2-audit-final.log`).
  Formal review remains pending.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Merge > ../tmp/fv-s942/fv-34-merge-diff/build.log 2>&1`
2. `formal/scripts/audit --module Merge --vectors > tmp/fv-s942/fv-34-merge-diff/audit.log 2>&1`
