# schematic-17-core-move-contract

- planId: schematic-17-core-move-contract; wave 4;
  dependsOn: schematic-02-ir-registry, schematic-09-core-coordinates-snap
- design: section 3.3 "Moves" rules 1-3, section 12 core move plan
- progress log: impl-plans/progress/schematic-17-core-move-contract.md

## Intent

Make keyboard nudge build schematic destinations from one shared canonical
delta and make `Editor.moveElements` keep schematic destinations canonical.

## Non-goals

Drag gesture (plan 41), CLI absolute moves (plan 30), connectivity tests
(plan 23).

## writePaths

- packages/core/src/editor/facade/element-editing.ts
- packages/core/src/editor/facade/selection-editing.ts
- packages/core/src/editor/schematic-move.test.ts (new)
- impl-plans/progress/schematic-17-core-move-contract.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `element-editing.ts:moveElements` (or the facade method that applies the
  absolute destinations): for elements with `isSchematicElementType`, apply
  `canonicalTarget` to destination x and y. Other types untouched.
- `selection-editing.ts:nudgeSelection` (~lines 184-200): for schematic
  elements build each destination with `shiftedTarget(origin, delta)` where
  `delta` is the single nudge delta; non-schematic elements keep the current
  `origin + delta`.

## Pitfalls

- Do not reconstruct a per-element delta from destination minus origin.
- Wire `points` are offsets and are not moved.
- Behaviour for every non-schematic type must be identical (existing tests).

## Tests (schematic-move.test.ts)

- Editor with a schematic page: wire at origin x `-1` (end offset 0) and
  junction at `-0.999`, both selected; `nudgeSelection` with x delta
  `-0.005` -> both stored x are `-1.01`.
- `moveElements` with an absolute target x `0.875` for a schematic junction
  -> stored `0.88`.
- a `shape.geo` rectangle nudged by `-0.005` keeps the existing raw
  behaviour (value unchanged from current semantics).

## Verification

- `bun test packages/core/src/editor/schematic-move.test.ts packages/core/src/editor.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.
