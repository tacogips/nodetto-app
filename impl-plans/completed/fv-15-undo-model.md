# fv-15-undo-model

- planId: fv-15-undo-model
- planPath: impl-plans/active/fv-15-undo-model.md
- progressPath: impl-plans/progress/fv-15-undo-model.md
- wave: 3
- dependsOn: fv-01-scaffold, fv-02-audit, fv-05-stubs-b
- Design: sections 3 (B1, B8), 6.6, 7.
- writePaths: `formal/Nodetto/Undo/Model.lean`, `formal/Nodetto/Undo/Vectors.lean`,
  `formal/Nodetto/Undo.lean`, `formal/vectors/undo.json`,
  `impl-plans/progress/fv-15-undo-model.md`, `tmp/fv-s942/fv-15-undo-model`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Models of `packages/core/src/history.ts` `History` and of the store part of
`packages/core/src/commands.ts` `applyCommands` (create, delete without references,
`replaceVisual` as update).

## Changes

- `formal/Nodetto/Undo/Model.lean`, `namespace Nodetto.Undo`: exactly the design 6.6
  history signatures (`Entry`, `History` with top at head, `push`, `beginBatch`,
  `endBatch`, `abortBatch`, `undo`, `redo`, `clear`, `nonEmpty`, `Inverts`) and store
  signatures (`ElemId`, `Store`, `Cmd`, `lookup`, `applyCommands`).
  - `push`: empty `undo` -> unchanged; depth > 0 -> merge into `pending` (newest undo
    first, redo oldest first); else commit: `(e :: undoStack).take limit`, redo `[]`.
  - `endBatch`/`abortBatch`: no-op at depth 0; inner close only decrements; outermost
    commits (end) or returns `some pending.undo` with pending cleared (abort).
  - `undo`/`redo`: pop the head, push onto the other stack (no trim), return the
    commands run.
  - `applyCommands`: fold with `Except`; create fails if the id exists; delete removes
    present ids, deduplicated, restores in sorted id order (`String` `<`, which equals
    code-unit order for E-encoded ids); update fails when missing; inverse list built
    front-first (`undo.unshift`).
- `formal/Nodetto/Undo.lean`: `import Nodetto.Undo.Model`.
- `formal/Nodetto/Undo/Vectors.lean`: module `"undo"`, sources
  `["packages/core/src/history.ts","packages/core/src/commands.ts"]`, with `C := String`.
  - `history {limit, ops}`: ops are `{"op":"push","undo":[..],"redo":[..]}`, `begin`,
    `end`, `abort`, `undo`, `redo`, `clear`; out `ok` list of per-op
    `{ran: [..] or null, undoSize, redoSize, batching}`. Include empty pushes, nested
    batches, aborts, limit 0, 1 and 3, undo/redo on empty stacks.
  - `applyCommands {store:[[id,value]], commands}`; commands as
    `{"type":"create","id","value"}`, `{"type":"delete","ids"}`,
    `{"type":"update","id","value"}`; out `ok {store, undo}` or `err "command"`.
    Include delete of missing ids, duplicate ids, create of an existing id, update of
    a missing id, and multi-command lists.
- `formal/vectors/undo.json`: generated, committed.

## Pitfalls

- `History.limit` trimming happens only in `commit`, not in `redo`.
- Output stores in vectors sorted by id so the TS test compares deterministically.

## Acceptance criteria

- [x] `Nodetto.Undo` builds; vectors are fresh, 200+ cases, 20+ per fn.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Undo > ../tmp/fv-s942/fv-15-undo-model/build.log 2>&1`
2. `formal/scripts/audit --module Undo --vectors > tmp/fv-s942/fv-15-undo-model/audit.log 2>&1`
