# M22 capture-22-report-text (new in revision 4)

- Stage: wave 1. dependsOn: none (the reply contract is design 6.3 as
  serialized by `crates/capture/src/report.rs` at `be8fa5d`).
- Design: sections 4.2 (text and JSON), 6.3 (reply keys), 6.6 (guarantee
  words), 6.7 (body notes, sampled error), 8.5, 12.
- writePaths: `packages/core/src/capture/report.ts`,
  `packages/core/src/capture/report.test.ts`,
  `packages/core/src/capture/describe.ts` (new),
  `packages/core/src/capture/describe.test.ts` (new),
  `packages/core/src/capture/index.ts` (one export line),
  `apps/cli/src/capture-help/interference.ts`,
  `impl-plans/active/capture-22-report-text.md`, `tmp/capture/m22`
- Pre-authorised: `apps/cli/src/capture-command.test.ts:454-465` ("explains
  every option") runs unchanged and must pass with the new usage lines.

## Intent

The text and parsed data that both the CLI (M23) and the desktop (M14)
show, written once in the core. M14 imports these through `@nodetto/core`
in wave 2, so the export line is added here (design 8.5).

## Non-goals

No CLI wiring, no option parsing (M20), no Rust changes, no `capture-help/cad.ts`
(M18). Do not change the wire format.

## Changes

1. `report.ts`: `SolidAnalysisReport` gains `cappedCount: number`,
   `budget: number`, `cappedWithoutHit: readonly (readonly [number, number])[]`;
   the parser requires them when `analysis` is present (validate like the
   existing `uncheckedCount`, `report.ts` validators around `:55-70`). Keep
   accepting `absent`.
2. `describe.ts` (pure; follows design 4.2 word for word):
   - `export interface DescribedPair { readonly a: string; readonly b: string; readonly aName: string; readonly bName: string; readonly volumeMm3: number; readonly min: Vec3; readonly max: Vec3; readonly source: "analysis" | "view"; readonly approximate: boolean }`
   - `export function describeInterference(report: SolidReport, bodies: readonly { readonly id: string; readonly name: string }[]): { readonly found: number; readonly unchecked: number; readonly lines: readonly string[]; readonly json: CaptureInterferenceJson | null }`
     where `CaptureInterferenceJson` has `cellMm`, `candidates`, `checked`,
     `unchecked` (id pairs), `uncheckedCount`, `cappedCount`,
     `cappedWithoutHit` (id pairs), `budget`, `pairs: DescribedPair[]`;
     `approximate` is the wire pair's `capped`.
   - Lines: `interference: <n> (<k> candidate pair[s] checked, cell <c> mm)`;
     per pair `  <a> x <b>: volume <v> mm3, box <min> .. <max> mm`, volume
     with four significant digits, coordinates and cell with at most three
     decimals and trailing zeros removed, `volume under 0.001 mm3` below
     0.001, suffix `, approximate` when capped, ` (found in the picture
     only)` for source `view`. With unchecked candidates the first line is
     `interference: <n> found, <u> of <total> candidate pairs not checked
     (cell <c> mm)` and after the pairs the first twenty `  not checked:
     <a> x <b>` then `  ... and <r> more; narrow with --interference-bodies`.
     When `cappedCount > 0`: `  refinement capped on <k> checked pairs (<j>
     without a hit); sub-cell parts of those pairs may be missed; narrow
     with --interference-bodies`. No analysis: `interference: not checked`.
   - `export function describeBodies(report: SolidReport, model: CadCaptureModel): { readonly line: string; readonly errors: readonly { readonly id: string; readonly code: string; readonly text: string }[] }`
     `bodies: <n> (<names, first eight, then ...>)` with notes
     `[hidden behind other bodies]`, `[outside the picture]`, `[no
     material]`, `[not sampled]` (unknown), `[differs from the app, see
     errors]` (material at the end and `emptiedByStep` not -1), `[open mesh,
     not checked]` (`open`), `[not in the picture]` (`absent`, the M9 note).
     For every body with `emptiedByStep` not -1, one error: id = the
     feature of that step (from the model's body steps), code
     `cad.result.empty`, text `(sampled): leaves no material in "<body>";
     the app rejects this feature and keeps the body, this picture applies
     it`. Imitate the M9 note handling in `apps/cli/src/capture-cad.ts`
     (`drawn: ""` table around `:105-115`) but do not edit that file.
3. `index.ts`: `export * from "./describe.ts";`
4. `capture-help/interference.ts` (the part M3 left empty; shape
   `CaptureHelpPart` from `apps/cli/src/capture-help.ts`): usage line
   `[--no-interference | --interference-cell <mm>] [--interference-bodies <id,id,...>] [--fail-on-interference]`;
   body with one `  --option` line per option, the definition (shared
   volume above 0.001 mm; touching faces are not interference; reference
   bodies take part), volume and box, the guarantee in the words of design
   6.6 with the printed cell and its limits (capped pairs, slivers), the
   facet note, the hatch sentences of design 6.6 (striped, visible through
   other bodies, replaces shading; `--no-interference` for an unobstructed
   view; `(found in the picture only)`), the capped line, and how to finish
   a check that printed `not checked`.

## Pitfalls

- Number formatting must be deterministic and locale-free (no
  `toLocaleString`); four significant digits for volumes via own rounding.
- `describeBodies` must not assume `emptiedByStep` indexes a union step.

## Tests

- `report.test.ts`: the Rust test JSON of `crates/capture/src/report.rs:229-232`
  parses with all new keys; a report missing `cappedCount` is rejected.
- `describe.test.ts`: one pair; several pairs; capped plus complete pair
  with `cappedCount` 1 and empty `cappedWithoutHit` -> only the capped
  pair has `, approximate` in text and `approximate: true` in JSON; view
  source; 25 unchecked -> twenty lines plus `... and 5 more`,
  `uncheckedCount` 25; none; not checked; formatting (0.0004 -> `under
  0.001`, 590.404 -> `590.4`, 12 -> `12`); each body note; error for a body
  emptied and refilled names the feature of `emptiedByStep`.
- `capture-command.test.ts` unchanged passes (usage options documented).

## Acceptance criteria

- Text and JSON forms match design 4.2 and mark the same approximate pairs.
- `describeInterference`, `describeBodies` are exported from `@nodetto/core`.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bunx biome check packages/core/src/capture/report.ts packages/core/src/capture/report.test.ts packages/core/src/capture/describe.ts packages/core/src/capture/describe.test.ts packages/core/src/capture/index.ts apps/cli/src/capture-help/interference.ts && bun test packages/core/src/capture apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts'`
2. `sh -c 'mkdir -p tmp/capture/m22; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m22/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m22/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture/describe.test.ts'`

## Progress

Implemented the report contract, descriptions, exports, help, and focused regression tests. Both required verification commands pass on the shared tree: 167 tests in the main gate and 3 in the strict core gate. Formal review and acceptance remain downstream.
