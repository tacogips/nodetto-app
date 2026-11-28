# fv-33-merge-canon

- planId: fv-33-merge-canon
- planPath: impl-plans/active/fv-33-merge-canon.md
- progressPath: impl-plans/progress/fv-33-merge-canon.md
- wave: 4
- dependsOn: fv-16-merge-model
- Design: sections 3 (B5), 6.7.
- writePaths: `formal/Nodetto/Merge/Canon.lean`, `formal/Nodetto/Merge.lean`,
  `impl-plans/progress/fv-33-merge-canon.md`, `tmp/fv-s942/fv-33-merge-canon`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Lemma layer 1 of 4 for the merge theorems: `same` is an equivalence and respects
object structure. No design statement is completed here.

## Changes

- `formal/Nodetto/Merge/Canon.lean` with lemmas (names at your choice):
  - `same` is reflexive, symmetric, transitive.
  - `same (some (.obj a)) x = true` implies `x` is an object, and for every key `k`,
    `same (lookupFirst a k) (lookupFirst b k) = true`; conversely, two objects whose
    first-occurrence key sets are equal and whose lookups are pairwise `same` are
    `same` (the key-order-insensitivity lemma).
  - Sorting lemma: two strictly sorted key lists with the same members are equal
    (needed for the converse above).
  - `same` with `none` only on `none`; arrays are `same` exactly when element-wise
    `same` with equal length; scalars only when equal.
- `formal/Nodetto/Merge.lean`: add `import Nodetto.Merge.Canon`.

## Pitfalls

- The key order used in `canon` must be a strict total order you can prove facts
  about; if the model's choice makes this hard, raise it in the progress log rather
  than editing `Model.lean` (owned by fv-16, already landed); a model change needs a
  follow-up amendment.
- Duplicate keys in a model object: `canon` keeps the first; lemmas are about
  `lookupFirst`.

## Acceptance criteria

- `Nodetto.Merge` builds; vectors unchanged; no forbidden token.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Merge > ../tmp/fv-s942/fv-33-merge-canon/build.log 2>&1`
2. `formal/scripts/audit --module Merge --vectors > tmp/fv-s942/fv-33-merge-canon/audit.log 2>&1`
