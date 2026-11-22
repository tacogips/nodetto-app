# M20 capture-20-interference-cli (revision 4: request contract and options)

- Stage: wave 1. dependsOn: none.
- Design: sections 4.1, 4.2, 6.3, 6.6, 8.5 ("Request contract"), 12.
- writePaths: `packages/core/src/capture/cad-request.ts`,
  `packages/core/src/capture/cad-request.test.ts`,
  `apps/cli/src/capture-interference-options.ts` (new),
  `apps/cli/src/capture-interference-options.test.ts` (new),
  `packages/io/src/nmesh/capture-decoder.ts` (new),
  `packages/io/src/nmesh/capture-decoder.test.ts` (new),
  `packages/io/src/nmesh/index.ts` (one export line),
  `impl-plans/active/capture-20-interference-cli.md`, `tmp/capture/m20`
- Pre-authorised: none. Existing `cad-request.test.ts` cases stay unchanged
  and must still pass; the committed `apps/cli/src/__fixtures__/capture-plate-default.ncs1`
  must stay byte-identical (the CLI does not pass `interference` until M23).

## Intent

Give every later plan the full typed request contract in wave 1, so M11,
M14 and M23 can work in isolation: the interference request, the draw-bit
rule, the default shared by both hosts, the mesh decoder hook and one
decoder function, and a pure parser for the four CLI options.

## Non-goals

No change to `capture-command.ts`, `capture-cad.ts`, help parts, the
fixture, `scene.ts`, `report.ts` or any Rust. `decodeMesh` is accepted and
ignored here (M11 consumes it). No printing of reports (M22, M23).

## Changes

1. `cad-request.ts`:
   - `export interface CadCaptureInterference { readonly cellMm: number; readonly bodies?: readonly string[] }`
   - `export type CaptureMeshDecoder = (data: string) => { readonly positions: Float64Array; readonly triangles: Uint32Array }`
   - `CadCaptureRequest` gains `readonly interference?: CadCaptureInterference | null`
     and `readonly decodeMesh?: CaptureMeshDecoder`.
   - `export const DEFAULT_CAD_INTERFERENCE: CadCaptureInterference` =
     `{ cellMm: 0.25 }` (frozen with `Object.freeze`).
   - `prepareCadCapture`: `interference` absent or `null` -> pass
     `interference: null` to `writeCaptureScene` exactly as today
     (`cad-request.ts:60`). Otherwise pass `{ cellMm, budgetMillionRays: 24,
     toleranceMm: 0.001, draw: true, bodies }` (options become 3). `cellMm`
     outside 0.01..10 -> `CaptureInputError`.
   - Body queries (`bodies` given): each entry matches a body by full id,
     unique id prefix, or exact name (model body names as in
     `scene.ts:CaptureBody`); no match or several matches -> `CaptureInputError`
     whose message lists the body names; fewer than two distinct bodies
     selected -> `CaptureInputError`. Matched indices are passed sorted and
     de-duplicated.
2. `capture-interference-options.ts` (pure, part of the engine bundle, no
   Node imports):
   - `export const CAPTURE_INTERFERENCE_VALUE_OPTIONS = ["--interference-cell", "--interference-bodies"] as const;`
   - `export const CAPTURE_INTERFERENCE_FLAGS = ["--no-interference", "--fail-on-interference"] as const;`
   - `export function parseInterferenceOptions(options: ReadonlyMap<string, string>, flags: ReadonlySet<string>): { readonly interference: CadCaptureInterference | null; readonly failOnInterference: boolean } | { readonly error: string }`
     default `DEFAULT_CAD_INTERFERENCE`; `--interference-cell` a finite
     number 0.01..10; `--interference-bodies` split on `,`, trimmed, empty
     entries are an error; `--no-interference` gives `null` and is an
     error together with any of the other three.
   - `export function interferenceExitCode(report: SolidReport, failOnInterference: boolean): 0 | 1`
     -> 1 only with the flag and (`pairs.length > 0` or
     `analysis.uncheckedCount > 0`); capped pairs alone never give 1.
   Imitate the option style of `apps/cli/src/capture-cad.ts` (`vector`,
   `view` helpers around `:49-95`).
3. `packages/io/src/nmesh/capture-decoder.ts`:
   `export function decodeCaptureMesh(data: string): { positions: Float64Array; triangles: Uint32Array }`
   = `toTriangleMesh(decodeNmesh(fromInline(data)))` with positions copied
   into a new `Float64Array` when they are a `Float32Array`; errors
   propagate (M11 maps them to `cad.mesh.invalid`). Export it from
   `packages/io/src/nmesh/index.ts`. Do not edit `packages/io/src/index.ts`.

## Pitfalls

- `packages/core` must not import `@nodetto/io` (decoder lives in io; the
  type is structural).
- Absent `interference` must give the bytes of today; test it against the
  committed fixture.

## Tests

- `cad-request.test.ts`: Plate document from `apps/cli/src/__fixtures__/capture-plate.jsonl`
  with `iso`, 1024 x 768, light and no `interference` -> bytes equal the
  committed `capture-plate-default.ncs1`; `interference: null` -> same;
  `DEFAULT_CAD_INTERFERENCE` -> options word 3 at offset 28, budget 24 at
  32, tolerance 0.001 at 144, cell 0.25 at 152, analysed bit on every body;
  `bodies: ["Plate", "<unique id prefix of Block>"]` -> only those two
  flagged; unknown, ambiguous and single-body queries -> `CaptureInputError`
  listing names; `decodeMesh` given -> bytes unchanged (ignored until M11).
- `capture-interference-options.test.ts`: default; cell 1; cell 0.005 and
  11 and `abc` -> error; bodies `A,B`; `--no-interference` -> null;
  `--no-interference --interference-cell 1` -> error; exit code table:
  pair+flag 1, unchecked only+flag 1, capped only+flag 0, any without flag 0.
- `capture-decoder.test.ts`: a 12-triangle cube encoded with
  `encodeNmesh`/`toInline` round-trips to `Float64Array` positions and 36
  indices; a corrupted string throws `NmeshError`.

## Acceptance criteria

- The full request contract of design 8.5 exists and is exported; the
  fixture stays byte-identical.
- The option parser and exit rule match design 4.1, 4.2 and 12.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bunx biome check packages/core/src/capture/cad-request.ts packages/core/src/capture/cad-request.test.ts apps/cli/src/capture-interference-options.ts apps/cli/src/capture-interference-options.test.ts packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/index.ts && bun test packages/core/src/capture apps/cli/src/capture-interference-options.test.ts packages/io/src/nmesh/capture-decoder.test.ts'`
2. `sh -c 'mkdir -p tmp/capture/m20; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m20/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m20/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture/cad-request.test.ts'`
3. `sh -c 'bun test apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts'` (unchanged files still pass)

## Progress

Implemented the request contract, interference selection and pure CLI options, plus the NMESH capture decoder and regression tests. The legacy fixture remains byte-identical. On the moving shared tree, verification commands 1, 2 and 3 passed with 114, 13 and 63 tests respectively; complete logs are under `tmp/capture-s868/capture-20-interference-cli/`. Formal review and downstream M11/M23 wiring remain pending.
