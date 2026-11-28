# fv-31-undo-stack-proofs

- planId: fv-31-undo-stack-proofs
- planPath: impl-plans/active/fv-31-undo-stack-proofs.md
- progressPath: impl-plans/progress/fv-31-undo-stack-proofs.md
- wave: 4
- dependsOn: fv-15-undo-model
- Design: sections 6.6, 8.
- writePaths: `formal/Nodetto/Undo/Stack.lean`, `formal/Nodetto/Undo.lean`,
  `impl-plans/progress/fv-31-undo-stack-proofs.md`, `tmp/fv-s942/fv-31-undo-stack-proofs`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove the nine history stack laws of design 6.6.

## Changes

- `formal/Nodetto/Undo/Stack.lean`: `undo_then_redo`, `redo_then_undo`,
  `push_clears_redo`, `push_empty`, `abortBatch_keeps_stacks`, `batch_one_step`,
  `batch_noop`, `abortBatch_reverts`, `batch_inverts`, verbatim.
- `formal/Nodetto/Undo.lean`: add `import Nodetto.Undo.Stack`.

## Pitfalls

- Batch theorems: prove a fold lemma for `push` at `depth >= 1` describing `pending`
  after a list of entries (`none` when every entry is empty, else the combined
  entry over `nonEmpty`), starting from `pending = none`.
- `batch_inverts`: induction on `es` with `hrun` and `hnil`; reversed concatenation.

## Acceptance criteria

- [x] The audit passes for the nine names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Undo > ../tmp/fv-s942/fv-31-undo-stack-proofs/build.log 2>&1`
2. `formal/scripts/audit --module Undo --theorem undo_then_redo --theorem redo_then_undo --theorem push_clears_redo --theorem push_empty --theorem abortBatch_keeps_stacks --theorem batch_one_step --theorem batch_noop --theorem abortBatch_reverts --theorem batch_inverts > tmp/fv-s942/fv-31-undo-stack-proofs/audit.log 2>&1`
