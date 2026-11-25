# car16-p2-cad-even-depth-search

- planId: car16-p2-cad-even-depth-search; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car16-p2-cad-even-depth-search.md
- Finding: `performance-cad-shared-perforated-profile-depth-rescans`
  (medium).
- Design: `design-docs/specs/design-ai-capture.md` 32.1 R16-2.
- Worker rules: `car16-00-overview.md`.
- Evidence: `tmp/car16-r16/car16-p2-cad-even-depth-search/`.

## Intent and context

`createCadGeometry().extrude` (`packages/core/src/cad/history.ts`, about
`:604-650`) builds each sketch profile once and reuses `profile.loops` for
every whole-sketch extrusion (`semantic.loops === undefined`). Even so, the
even-depth check `loops.some(({ depth }) => depth % 2 === 0)` (about
`:639`) runs on every extrusion. `buildLoops` emits closed circles before
the boundary (`loops.ts:568`, `:601`), so a plate with H holes costs
H + 1 visits per extrusion.

A successful whole profile always has a depth-0 loop, for three reasons:
- `buildLoops` returns `cad.profile.empty` when it finds no loops
  (`loops.ts:696`).
- Depths count containing loops of the same set.
- Crossing contours are rejected first (`loops.ts:610-612`).

So the search is needed only for explicit selections.

Non-goals:
- Do not change `buildLoops`, `loops.ts`, `construction.ts`, `check.ts`,
  `bounds.ts`, the CLI or the `semantic.loops` interface.
- Do not cache the search result. Do not touch the PCB path.
- Do not edit `history.test.ts`. It is gated read-only.

## Changes (`packages/core/src/cad/history.ts`)

1. Add `evenDepthVisits: 0` to `cadGeometryWork` (`:439-447`), after
   the existing fields.
2. Step 1, counter only, no behaviour change: count one visit per
   predicate evaluation of today's search on every path. Write the
   tests, then run the fail-before.
3. Step 2, the change:
   - `semantic.loops !== undefined`: unchanged. Search the selected
     subset, counting visits, and return `cadFailure("cad.profile.empty")`
     when no even-depth loop exists. This covers hole-only and empty
     selections.
   - `semantic.loops === undefined`: no search and no visits. Keep an
     O(1) `loops.length === 0` check that returns
     `cadFailure("cad.profile.empty")`.
   - Everything after it is unchanged: `extrudeSpan`, `withinExtent`,
     `cad.limit` and stats.

Pitfalls:
- Keep the failure ordering. Entity failures and profile errors return
  earlier, as today, and `cad.limit` is checked after the profile check.
- Do not use `semantic.loops?.length` as the condition. An empty
  selection `loops: []` must still search, and therefore fail.

## Tests (`packages/core/src/cad/check.test.ts`)

Imitate "shared multi-loop extrema work scales with profile size"
(about `:411-446`): the `report(...)` helper, `sketch`, `extrude`,
`rectangle` and `cadElement` from `./testing/documents.ts`. Import
`cadGeometryWork` from `./history.ts`. Set
`cadGeometryWork.evenDepthVisits = 0` before each measurement.

Fixture `perforatedPlate(k, loops?)`:
- `sketch("plate", "a")`;
- `rectangle("plate", 0, 0, 200, 200)`, whose IDs are `plate-edge-0..3`;
- 256 circles `hole-<i>` at `c = [10 + 12 * (i % 16), 10 + 12 * floor(i / 16)]`,
  `r = 1`;
- k extrusions `tool-<i>` with `{ sketch: "plate", distance: i + 1, op: "new", ...(loops ? { loops } : {}) }`.

Cases:
- Whole profile, k = 1 and k = 32:
  - `errors` equal `[]`.
  - `bounds` equal `{ min: [0, 0, 0], max: [200, 200, k] }`.
  - `evenDepthVisits === 0`. Before the fix it is 257 and 8,224; save
    that as `fail-before.log`.
  - Log the counts.
- Explicit hole-only selection, k = 1, `loops` = all 256 hole IDs:
  `errors` match `[{ id: "tool-0", code: "cad.profile.empty" }]`.
- Explicit empty selection, k = 1, `loops: []`: the same
  `cad.profile.empty` error.
- Explicit boundary selection, k = 1, `loops: ["plate-edge-0"]`:
  `errors` equal `[]` and `evenDepthVisits > 0`.
- Ordinary pin: `checkCadPage` on
  `generateCadDocument({ features: 500, entitiesPerSketch: 18 })` gives
  `evenDepthVisits === 0`. Record the before value, expected about 5,500.
  - The existing "ordinary document extrema work is pinned" test and its
    numbers stay unedited.

All existing tests in `check.test.ts` and `history.test.ts` stay unedited
and pass.

## Verification (each exits 0)

1. Fail-before (after step 1, before step 2):
   `bun test packages/core/src/cad/check.test.ts`. Expect exit 1 on the
   whole-profile `evenDepthVisits` and ordinary-pin assertions. Save it as
   `fail-before.log`.
2. `export CARGO_TARGET_DIR=target/r16-cad-depth && bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/check.test.ts && bun test packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts`
   - Expect 0 failures and the new tests passed. Save it as `gate.log`.

## Done criteria

- [x] Command 2 exits 0, and `fail-before.log` shows exit 1 with 257 and
      8,224 visits.
- [x] The measured counts, before and after, are in the progress log.
- [x] Every file this plan edited is in its writePaths.
- [x] The progress log reads `done`.
