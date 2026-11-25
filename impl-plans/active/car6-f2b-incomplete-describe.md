# car6-f2b-incomplete-describe

- planId: car6-f2b-incomplete-describe; wave 1; dependsOn: none
- planPath: impl-plans/active/car6-f2b-incomplete-describe.md
- progressPath: impl-plans/progress/car6-f2b-incomplete-describe.md
- Finding: function-capture-coarse-scan-reported-as-refinement (R6-2, TypeScript core).
- Design: `design-docs/specs/design-ai-capture.md` 24.1 R6-2 "Rule (TypeScript)" and the
  report.test.ts / describe.test.ts items of R6-2 Tests.
- writePaths: `packages/core/src/capture/report.ts`, `packages/core/src/capture/report.test.ts`,
  `packages/core/src/capture/describe.ts`, `packages/core/src/capture/describe.test.ts`,
  `impl-plans/active/car6-f2b-incomplete-describe.md`,
  `impl-plans/progress/car6-f2b-incomplete-describe.md`,
  `tmp/car6-r6/car6-f2b-incomplete-describe`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car6-00-overview.md`.

## Intent and context

The Rust report gains an optional `analysis.incomplete` list (pairs whose coarse grid was
abandoned without a hit; a subset of `cappedWithoutHit`). The shared description must
parse it, say so in text and JSON, and never call a pictured overlap unknown. Both the
CLI (`capture-cad.ts`) and the desktop (`export-handlers.ts:294-302`) print
`describeInterference(...).lines`, so they inherit the text without code changes.

Non-goals: no change to `describeBodies` (car6-f4 edits it next), to CLI or desktop
files, to existing lines when `incomplete` is absent or empty.

## Changes

`report.ts`:
- `SolidAnalysisReport` gains `readonly incomplete?: readonly (readonly [number, number])[];`
- `analysis()` validator (`:77-100`): accept the key absent, or an array validated
  exactly like `cappedWithoutHit` (`:94-99`); anything else fails the existing parse.

`describe.ts` `describeInterference` (with `k = analysis.incomplete?.length ?? 0`):
- Headline: `uncheckedCount > 0` unchanged. Else if `k > 0`:
  `interference: <found> found, <k> of <checked> checked candidate pair[s] incomplete (cell <decimal(cell)> mm)`
  ("pair" when `checked === 1`, "pairs" otherwise). Else unchanged.
- After the not-checked lines (and their "... and N more"), for the first 20 incomplete
  pairs one line, chosen by whether `report.pairs` has a record with the same `a` and `b`:
  - none: `  incomplete: <A> x <B>; the coarse check stopped before covering this pair, interference not determined`
  - one: `  incomplete: <A> x <B>; the coarse check stopped before covering this pair, the overlap listed above was found in the picture only`
  - then `  ... and <k - 20> more incomplete; narrow with --interference-bodies` when `k > 20`.
  Names through `plain()`.
- Refinement line: print only when `cappedCount - k > 0`, with counts `cappedCount - k`
  and `Math.max(0, cappedWithoutHit.length - k)`; text otherwise identical.
- Return value gains `incomplete: number`; `json` gains `incomplete` (body-id pairs via
  `ids`) only when `k > 0` (conditional spread). `CaptureInterferenceJson` gains
  `readonly incomplete?: readonly (readonly [string, string])[];`.

Pitfalls: with `k = 0` every line and the JSON object must be byte/deep-equal to today
(no `incomplete` key at all). Do not change `found`, `pairs` or the view-pair line. Keep
indexed reads typed (`bodies[i] ?? ...` pattern of `body()`).

## Tests (write first; record failures)

`report.test.ts` (imitate `"reads a hidden-target emptying step"`, `:45`):
- report without `incomplete` -> parses, `analysis.incomplete` undefined.
- `incomplete: [[0,1]]` -> parsed.
- `incomplete: [[0]]` and `incomplete: "x"` -> rejected with the existing error.

`describe.test.ts` (imitate `"lists twenty unchecked pairs and exact remainder"`, `:59`):
- k = 1 of 1 checked, no pair record, cappedCount 1, cappedWithoutHit [[0,1]] ->
  headline `interference: 0 found, 1 of 1 checked candidate pair incomplete (cell 0.25 mm)`,
  the "not determined" line, no refinement line; `json.incomplete` is `[[id0,id1]]`.
- mixed: same analysis plus a capped `source: "view"` pair 0-1 -> headline `1 found`,
  today's picture-only pair line, the picture-only incomplete line, no "not determined";
  JSON has both the `pairs` record and `incomplete`.
- k = 1 with cappedCount 2, cappedWithoutHit [[0,1],[0,2]] -> refinement line shows
  `refinement capped on 1 checked pairs (1 without a hit)`.
- k = 22 -> 20 incomplete lines plus `... and 2 more incomplete`.
- k = 0 (existing fixtures) -> lines and json deep-equal to today; no `incomplete` key.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/capture/report.ts packages/core/src/capture/report.test.ts packages/core/src/capture/describe.ts packages/core/src/capture/describe.test.ts && bun test packages/core/src/capture/report.test.ts packages/core/src/capture/describe.test.ts`
   - evidence: new cases fail before, pass after; existing cases unchanged.

## Done criteria

- Parser, text, JSON and return field as specified; all listed cases pass; progress log
  `done`.

## Implementation status

Done: parser, shared description, conditional JSON and focused regression tests. Formal review and integration gates remain downstream.
