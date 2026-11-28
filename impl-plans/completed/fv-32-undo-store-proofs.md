# fv-32-undo-store-proofs

- planId: fv-32-undo-store-proofs
- planPath: impl-plans/active/fv-32-undo-store-proofs.md
- progressPath: impl-plans/progress/fv-32-undo-store-proofs.md
- wave: 5
- dependsOn: fv-31-undo-stack-proofs
- Design: sections 3 (B8), 6.6, 8.
- writePaths: `formal/Nodetto/Undo/StoreUndo.lean`, `formal/Nodetto/Undo.lean`,
  `impl-plans/progress/fv-32-undo-store-proofs.md`, `tmp/fv-s942/fv-32-undo-store-proofs`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove `applyCommands_undo`: applying the returned inverse list restores every lookup.

## Changes

- `formal/Nodetto/Undo/StoreUndo.lean`: `applyCommands_undo`, verbatim.
- `formal/Nodetto/Undo.lean`: add `import Nodetto.Undo.StoreUndo`.

## Pitfalls

- Prove congruence first: two stores with equal `lookup` everywhere behave the same
  under `applyCommands` (same success, lookup-equal results, same inverse list).
- Single-command lemmas: create then `delete [id]`; delete then the sorted creates
  (ids distinct and absent after the delete); update then update with the old value.
- The inverse of a list is built front-first, so induct on `cs` with the inverse of
  the tail applied first.

## Acceptance criteria

- The audit passes for `applyCommands_undo`.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Undo > ../tmp/fv-s942/fv-32-undo-store-proofs/build.log 2>&1`
2. `formal/scripts/audit --module Undo --theorem applyCommands_undo > tmp/fv-s942/fv-32-undo-store-proofs/audit.log 2>&1`
