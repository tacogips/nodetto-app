# fv-35-merge-value

- planId: fv-35-merge-value
- planPath: impl-plans/active/fv-35-merge-value.md
- progressPath: impl-plans/progress/fv-35-merge-value.md
- wave: 6
- dependsOn: fv-34-merge-diff
- Design: sections 5 (D2), 6.7, 8.
- writePaths: `formal/Nodetto/Merge/Value.lean`, `formal/Nodetto/Merge.lean`,
  `impl-plans/progress/fv-35-merge-value.md`, `tmp/fv-s942/fv-35-merge-value`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove the five `mergeValue` statements.

## Changes

- `formal/Nodetto/Merge/Value.lean`: `mergeValue_unchanged_ours`,
  `mergeValue_unchanged_theirs`, `mergeValue_same_change`, `mergeValue_symm`,
  `mergeValue_conflict_iff`, verbatim.
- `formal/Nodetto/Merge.lean`: add `import Nodetto.Merge.Value`.

## Pitfalls

- Lookup lemma: in the object branch, the result's `lookupFirst k` is
  `(mergeValue (b k) (l k) (r k)).1` for keys in the union (and `none` outside), and
  the flag is the OR over keys.
- Symmetry needs `same`-transitivity in the second branch (if `l ~ b` and `r ~ b`
  then `l ~ r`).
- `conflict_iff`: case split as in the design reasoning (same l r; l ~ b; r ~ b; all
  objects; otherwise) using the fv-34 lemmas.

## Acceptance criteria

- The audit passes for the five names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Merge > ../tmp/fv-s942/fv-35-merge-value/build.log 2>&1`
2. `formal/scripts/audit --module Merge --theorem mergeValue_unchanged_ours --theorem mergeValue_unchanged_theirs --theorem mergeValue_same_change --theorem mergeValue_symm --theorem mergeValue_conflict_iff > tmp/fv-s942/fv-35-merge-value/audit.log 2>&1`
