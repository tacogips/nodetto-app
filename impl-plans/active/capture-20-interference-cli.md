# M20 capture-20-interference-cli

- dependsOn: M9 (`prepareCadCapture`, `SolidReport`, the CAD branch of the
  command), M10 (`Report.analysis`, `Report.pairs` in the reply JSON)
- Design: sections 4.1, 4.2, 6.6, 12
- writePaths: `packages/core/src/capture/cad-request.ts` and its test,
  `packages/core/src/capture/describe.ts` (new) and its test,
  `packages/core/src/capture/index.ts`, `apps/cli/src/capture-cad.ts` and
  its test, `apps/cli/src/capture-command.ts` and its test (four option
  names), `apps/cli/src/capture-help/interference.ts` (the part M3 left
  empty), `apps/cli/src/__fixtures__/capture-plate-default.ncs1`,
  `apps/cli/src/native-parity/capture.test.ts`
- Pre-authorised: `capture-plate-default.ncs1` is regenerated (the CLI
  now writes a scene with the analysis on); the Boa-against-Bun test of
  M9 in `apps/cli/native/src/engine_tests.rs` keeps comparing against it
  and is not edited.

## Contract

```ts
// cad-request.ts: CadCaptureRequest gains
readonly interference: { readonly cellMm: number; readonly bodies?: readonly string[] } | null;
// describe.ts (pure text, shared with the desktop)
export function describeInterference(report: SolidReport, bodies: readonly { id: string; name: string }[]):
  { readonly found: number; readonly unchecked: number; readonly lines: readonly string[] };
```

New options: `--no-interference`, `--fail-on-interference`,
`--interference-cell <mm>`, `--interference-bodies <id,id,...>`.

## Behavior

- `prepareCadCapture`: `interference` other than `null` writes cell
  `cellMm`, budget 24, tolerance 0.001, draw off (M17 turns it on) and
  the analysed bit for the named bodies or for all. `bodies` entries are
  matched against body ids, unique id prefixes and exact names; an entry
  that matches nothing or more than one body, or fewer than two bodies in
  total, is a `CaptureInputError` that lists the body names.
- CLI: default `{ cellMm: 0.25 }`; `--interference-cell` 0.01 to 10;
  `--interference-bodies` passes its comma-separated entries;
  `--no-interference` passes `null` and excludes the other three options.
- `describeInterference` (design 4.2): first line `interference: <n>
  (<k> candidate pairs checked, cell <c> mm)`; per pair `  <a> x <b>:
  volume <v> mm3, box <min> .. <max> mm` (volume with four significant
  digits, coordinates and cell with at most three decimals, trailing
  zeros removed; a volume below 0.001 is printed as `volume under 0.001
  mm3`; `, approximate` when capped; `(found in the picture only)` for
  the source `view`, which M17 produces). With unchecked
  candidates the first line is `interference: <n> found, <u> of <total>
  candidate pairs not checked (cell <c> mm)`, followed after the pairs by
  the first twenty as `  not checked: <a> x <b>` and `  ... and <r>
  more; narrow with --interference-bodies`. A report without analysis
  gives `interference: not checked`.
- `--json`: `interference` with `cellMm`, `candidates`, `checked`,
  `unchecked` (id pairs), `uncheckedCount`, `pairs` (`a`, `b`, `aName`,
  `bName`, `volumeMm3`, `min`, `max`, `source`, `approximate`).
- Exit code with `--fail-on-interference`: 1 when a pair is reported or a
  candidate was not checked; the image and the text are still written.
- Help part `interference.ts`: the definition (shared volume above 0.001
  mm; touching faces are not interference; reference bodies take part),
  volume and box, the guarantee in the words of design 6.6 with the
  printed cell, the facet note (curved faces are faceted at 0.01 mm, so
  an exact-fit round contact can report a sliver), the four options, and
  how to finish a check that printed `not checked`.

## Tests

- `cad-request.test.ts`: option bits, cell, budget and analysed flags in
  the scene bytes for the default, for named bodies and for `null`;
  unknown, ambiguous and single body queries.
- `describe.test.ts`: one pair, several pairs, capped, view source,
  unchecked with more than twenty, none, not checked; number formatting.
- `capture-cad.test.ts` (fake backend with canned reports): option
  validation and exclusions; text and JSON; exit code 1 with a pair, 1
  with only unchecked candidates, 0 otherwise and always 0 without the
  flag; the regenerated default fixture equals the command's scene.
- `native-parity/capture.test.ts` (native binary): `capture-plate.jsonl`
  prints `interference: 1 (1 candidate pair checked, cell 0.25 mm)` and
  a `Plate x Block` line whose volume is within 1% of 637.362; the
  interference lines are equal for `--view top`, `--view front` and
  `iso`; `--fail-on-interference` exits 1 and the file exists; with the
  block moved away (edited in the test's temporary copy) `interference:
  0`; a document with the 1.5 mm pin case built in the test prints one
  pair; `--interference-bodies Plate,Puck` prints 0;
  `--interference-cell 1` prints `cell 1 mm`; `--no-interference` prints
  `interference: not checked`.

## Acceptance criteria

- Interference is reported as text with the pair, the box, the volume
  and the cell, independent of the camera.
- The agent can restrict or refine the check, and the exit-code gate
  cannot pass while a candidate is unchecked.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun run lint:ts && bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts'`
2. `sh -c 'mkdir -p tmp/capture/m20; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m20/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m20/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture/describe.test.ts'`
3. `sh -c 'CARGO_TERM_QUIET=true cargo test -p nodetto-cli && CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts'`

## Progress

Pending.
