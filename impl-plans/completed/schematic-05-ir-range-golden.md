# schematic-05-ir-range-golden

- planId: schematic-05-ir-range-golden; wave 3; dependsOn: schematic-02-ir-registry
- design: sections 3.2 (`schematic.coordinateRange` on visual fields), 3.5
- progress log: impl-plans/progress/schematic-05-ir-range-golden.md

## Intent

Finish IR validation (visual x/y range for schematic types only) and add the
JSONL golden fixture covering all 18 types. Native parity
`documents.test.ts` picks the fixture up automatically.

## Non-goals

No change to validation of any non-schematic type; no edit of other golden
fixtures.

## writePaths

- packages/ir/src/validate.ts
- packages/ir/src/validate.test.ts
- packages/io/src/jsonl/golden.test.ts
- packages/io/src/__fixtures__/schematic.jsonl (new)
- impl-plans/progress/schematic-05-ir-range-golden.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `validate.ts`: a branch guarded by `isSchematicElementType(element.type)`
  emitting `schematic.coordinateRange` (error) when `visual.x` or `visual.y`
  is finite and `Math.abs(v) > SCHEMATIC_COORDINATE_LIMIT`. Place it where
  per-element visual checks run; imitate how existing element-level issues
  are pushed (same issue shape, path `visual.x`).
- `validate.test.ts`: add cases only (no edits to existing cases).
- `golden.test.ts`: add `"schematic"` to `GOLDEN` (only that).
- `__fixtures__/schematic.jsonl`: one `schematic` page, one element of each
  of the 18 types, keys in registry key order, coordinates canonical (2
  decimals max), lattice positions (multiples of 10), ids like `sch-r1`.
  Must reserialize byte for byte. Write it by hand, then confirm with the
  golden test; if the test reports a diff, fix the fixture, not the writer.

## Pitfalls

- Element-level visual check must not affect breadboard, PCB or CAD types.
- The fixture's wire points must be orthogonal; ic pins unique.
- Values must be nodetto's own (no KiCad library names).

## Tests

- validate.test.ts: schematic junction `visual.x = 2e307` ->
  `schematic.coordinateRange`; `1e9` -> none; a `breadboard.board` with
  `visual.x = 2e9` -> no `schematic.coordinateRange` issue.
- golden.test.ts: `schematic` fixture parses, validates with no errors and
  reserializes identically.

## Verification

- `bun test packages/ir/src/validate.test.ts packages/io/src/jsonl/golden.test.ts`
  exits 0.
- `bunx biome check packages/ir/src/validate.ts packages/ir/src/validate.test.ts packages/io/src/jsonl/golden.test.ts`
  exits 0.

## Done criteria

Both test files pass; all pre-existing golden fixtures still pass.
