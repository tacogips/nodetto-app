# fv-45-undo-conformance

- planId: fv-45-undo-conformance
- planPath: impl-plans/active/fv-45-undo-conformance.md
- progressPath: impl-plans/progress/fv-45-undo-conformance.md
- wave: 4
- dependsOn: fv-15-undo-model
- Design: sections 3 (B8), 6.6, 7 (undo rules).
- writePaths: `packages/core/src/history.formal.test.ts`,
  `impl-plans/progress/fv-45-undo-conformance.md`, `tmp/fv-s942/fv-45-undo-conformance`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Tie `History` and the store part of `applyCommands` to the Lean vectors. No product
code changes.

## Changes

- `packages/core/src/history.formal.test.ts` (new): read
  `formal/vectors/undo.json` (relative URL), typed guard.
  - `history` cases: `new History(runner, limit)` with a runner recording what ran
    (imitate `packages/core/src/history.test.ts` around `new History(`); each opaque
    vector command string `s` becomes the valid `Command` `{ type: "deletePage", id: s }`
    and is mapped back to `s` when recorded (no casts, no `any`; the runner only
    records, it never applies); after each op compare `ran` (or `null` when nothing ran or
    `undo`/`redo` returned false), `undoSize`, `redoSize`, `batching`.
  - `applyCommands` cases: build a store with one page and `shape.geo` elements whose
    `visual.x` is the model value (imitate `packages/core/src/store-commands.test.ts`);
    map `create` -> `createElement`, `delete` -> `deleteElements`, `update` ->
    `replaceVisual` with `{x: value}` (keep the other visual fields of the
    fixture), call `applyCommands`; compare resulting `visual.x` per id (sorted) and
    the undo commands mapped back to the vector form; `error` -> expect a thrown
    `CommandError`.

## Pitfalls

- Elements must carry no references so `expandDeletes` removes only the seeds.
- `replaceVisual` replaces the whole visual: give every fixture the same full visual
  except `x`.

## Tests

- Every vector case matches.

## Acceptance criteria

- [x] The test passes; `history.test.ts` passes unchanged.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Undo.Model > ../tmp/fv-s942/fv-45-undo-conformance/build.log 2>&1`
2. `bun test packages/core/src/history.formal.test.ts packages/core/src/history.test.ts > tmp/fv-s942/fv-45-undo-conformance/test.log 2>&1`
3. `bunx biome check packages/core/src/history.formal.test.ts`
