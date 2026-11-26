# fv-44-rotate-conformance

- planId: fv-44-rotate-conformance
- planPath: impl-plans/active/fv-44-rotate-conformance.md
- progressPath: impl-plans/progress/fv-44-rotate-conformance.md
- wave: 4
- dependsOn: fv-14-rotate-model
- Design: sections 3 (B3), 6.5, 7 (rotate rules).
- writePaths: `packages/core/src/breadboard/rotate.formal.test.ts`,
  `impl-plans/progress/fv-44-rotate-conformance.md`, `tmp/fv-s942/fv-44-rotate-conformance`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Tie `planBreadboardRotation` to the Lean rotation vectors, and check that the
fixture geometry copied into Lean equals the real catalogue. No product code changes.

## Changes

- `packages/core/src/breadboard/rotate.formal.test.ts` (new): read
  `new URL("../../../../formal/vectors/rotate.json", import.meta.url)`, typed guard.
  - For each `fixture` case: `2 * breadboardLocalBox(type, semantic).{x, y, width, height}`
    equal `localBox2.{x, y, width, height}` (`toBe` on each number);
    `2 * dx` and `2 * dy` of each `breadboardPinDefs(type, semantic)` entry equal
    `pinDefs2` in order; the doubled geometry recomputed from `localBox2`/`pinDefs2`
    with the fv-14 formulas (`cx = 5 * width2`, `cy = 5 * height2`, pin
    `(10 * (dx2 - x2), 10 * (dy2 - y2))`) equals `out`; and `PinsOnPitch` holds (every
    pin's difference from pin 1 is a multiple of 20 in both coordinates).
  - For each `rotate` case: build a store with one part element of that fixture at
    `visual {x: x2/2, y: y2/2, rotation: turns*90}` (imitate
    `packages/core/src/breadboard/test-builder.ts` `buildBreadboardDocument` and
    `packages/core/src/breadboard/editor-breadboard.test.ts` around
    `rotateBreadboardParts`), call `planBreadboardRotation(store, [id], quarterTurns)`
    and compare the `updateVisual` `{x, y, rotation}` with `{x2/2, y2/2, turns*90}`.

## Pitfalls

- Use `toBe` on numbers after the halving; positions are exact multiples of 0.5 (B3).
- Do not modify catalogue or rotation code; a mismatch is a finding to report.

## Tests

- Every fixture and rotate vector case matches.

## Acceptance criteria

- [x] The test passes.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Rotate.Model > ../tmp/fv-s942/fv-44-rotate-conformance/build.log 2>&1`
2. `bun test packages/core/src/breadboard/rotate.formal.test.ts > tmp/fv-s942/fv-44-rotate-conformance/test.log 2>&1`
3. `bunx biome check packages/core/src/breadboard/rotate.formal.test.ts`
