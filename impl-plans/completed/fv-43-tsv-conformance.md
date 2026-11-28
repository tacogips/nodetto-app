# fv-43-tsv-conformance

- planId: fv-43-tsv-conformance
- planPath: impl-plans/active/fv-43-tsv-conformance.md
- progressPath: impl-plans/progress/fv-43-tsv-conformance.md
- wave: 4
- dependsOn: fv-13-tsv-model
- Design: sections 5 (D1), 7, 10 (tsv characterization).
- writePaths: `packages/core/src/table-sheet/delimited.test.ts`,
  `packages/core/src/table-sheet/delimited.formal.test.ts`,
  `impl-plans/progress/fv-43-tsv-conformance.md`, `tmp/fv-s942/fv-43-tsv-conformance`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Pin the D1 behaviour with characterization tests (the code stays as is) and tie
`delimited.ts` to the Lean vectors.

## Changes

- `packages/core/src/table-sheet/delimited.test.ts`: append characterization tests.
- `packages/core/src/table-sheet/delimited.formal.test.ts` (new): read
  `new URL("../../../../formal/vectors/tsv.json", import.meta.url)`, typed guard;
  `parseTsv`, `serializeTsv`, and `roundTrip` (= `parseTsv(serializeTsv(grid))`) must
  equal `out.ok` exactly.

## Tests (pass now and after)

- `parseTsv(serializeTsv([["a"],[]]))` -> `[["a"]]`.
- `parseTsv(serializeTsv([[]]))` -> `[]`.
- `parseTsv(serializeTsv([[],["a"]]))` -> `[[""],["a"]]`.
- `parseTsv(serializeTsv([[""]]))` -> `[[""]]`.
- Every vector case matches.

## Pitfalls

- Do not modify `delimited.ts`. The path to `formal/` is four levels up.

## Acceptance criteria

- [x] All tests pass; the existing five tests pass unchanged.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Tsv.Model > ../tmp/fv-s942/fv-43-tsv-conformance/build.log 2>&1`
2. `bun test packages/core/src/table-sheet/delimited.formal.test.ts packages/core/src/table-sheet/delimited.test.ts > tmp/fv-s942/fv-43-tsv-conformance/test.log 2>&1`
3. `bunx biome check packages/core/src/table-sheet/delimited.test.ts packages/core/src/table-sheet/delimited.formal.test.ts`
