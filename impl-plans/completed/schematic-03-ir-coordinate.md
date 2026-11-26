# schematic-03-ir-coordinate

- planId: schematic-03-ir-coordinate; wave 2; dependsOn: schematic-01-ir-semantics
  (chain on `packages/ir/src/index.ts`)
- design: section 3.3 "Serialization-stable electrical geometry", 13 item 18
- progress log: impl-plans/progress/schematic-03-ir-coordinate.md

## Intent

Move the JSONL writer's `roundCoordinate` unchanged into ir and add
`coordinateKey`, so core connectivity and the io writer share one rounding
rule. JSONL output must stay byte-identical.

## Non-goals

No change to rounding semantics, `COORDINATE_PRECISION`, or any key order.

## writePaths

- packages/ir/src/keyOrder.ts
- packages/io/src/jsonl/canonical.ts
- packages/ir/src/index.ts
- packages/ir/src/coordinate-key.test.ts (new)
- impl-plans/progress/schematic-03-ir-coordinate.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- Move `roundCoordinate` (body verbatim, including its doc comment and the
  overflow guard) from `packages/io/src/jsonl/canonical.ts:46` into
  `packages/ir/src/keyOrder.ts` next to `COORDINATE_PRECISION`.
- Add `export function coordinateKey(value: number): number` =
  `Math.round(roundCoordinate(value) / COORDINATE_PRECISION)`.
- `canonical.ts`: `import { roundCoordinate } from "@nodetto/ir"` and
  `export { roundCoordinate }` so `packages/io/src/index.ts` and
  `packages/io/src/jsonl/source-lines.ts` keep importing it unchanged.
- `ir/index.ts`: export `roundCoordinate` and `coordinateKey` from
  `./keyOrder.ts` (line ~84 block).

## Pitfalls

- Do not "simplify" the magnitude-based rounding: ties go away from zero
  (`-0.125` -> `-0.13`); `Math.round(-12.5)` would give `-12`.
- Do not change `packages/io/src/index.ts`; the re-export keeps its import
  path valid.

## Tests (packages/ir/src/coordinate-key.test.ts)

- `roundCoordinate(-0.125) === -0.13`, `coordinateKey(-0.125) === -13`.
- `coordinateKey(0.004) === 0`, `coordinateKey(10.004) === 1000`,
  `coordinateKey(10.008) === 1001`.
- idempotence: `roundCoordinate(roundCoordinate(v)) === roundCoordinate(v)`
  for v in [-1.005, 1.005, 3.37, -0.999, 1e9].
- `coordinateKey(1e9) === 1e11`, `coordinateKey(-1e9) === -1e11`, distinct.

## Verification

- `bun test packages/ir/src/coordinate-key.test.ts packages/io/src/jsonl/canonical.test.ts packages/ir/src/semantics/schematic.test.ts`
  exits 0; canonical.test.ts still reports its 21 passes unchanged;
  `semantics/schematic.test.ts` is plan 01's test on the shared
  `packages/ir/src/index.ts`.
- `bun test packages/io/src/jsonl/golden.test.ts` exits 0 (byte-identical
  output).
- `bunx biome check <owned .ts files>` exits 0.

## Done criteria

Tests above pass; canonical.test.ts unedited; no other io file edited.
