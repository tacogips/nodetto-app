# car14-p4-pcb-frame-reuse

- planId: car14-p4-pcb-frame-reuse; wave 2
- implementation status: done; formal review and integration pending
- dependsOn: car14-p3-profile-extents (both edit `history.ts`)
- progressPath: impl-plans/progress/car14-p4-pcb-frame-reuse.md
- Finding: `performance-cad-repeated-pcb-outline-projections` (medium).
- Design: `design-docs/specs/design-ai-capture.md` 31.1 R14-4.
- Worker rules: `car14-00-overview.md`.
- Evidence: `tmp/car14-r14/car14-p4-pcb-frame-reuse/`.

## Intent and context

`createCadGeometry(...).pcb` (`packages/core/src/cad/history.ts`, near
`:566-580`) calls `baseFrame("xy")` for every PCB reference. The outline
loops are memoized per board page (`pcb-outline.ts:139-145`), but
`loopExtents` hits only when the frame object is the same
(`bounds.ts:54-55`). K references therefore project M vertices K times.

Reuse one lazily created XY frame per geometry walk.

Non-goals:
- Do not touch `frames.ts`, `bounds.ts`, `pcb-outline.ts`, `scene.ts` or
  `check.ts`.
- No module-level frame constant: the frame must not be shared across
  documents.
- No change to span, thickness, `withinExtent`, the `cad.limit` message
  or `extrude()`.

## Changes (`packages/core/src/cad/history.ts`)

Re-read the file fresh; p3 has changed `withinExtent`.

1. In `createCadGeometry`, declare `let pcbFrame: CadFrame | undefined;`
   next to the other per-walk maps.
2. In `pcb(semantic)`, replace `const frame = baseFrame("xy")` with
   `pcbFrame ??= baseFrame("xy")`, and use it for `withinExtent` and in
   the returned geometry.
3. Check every consumer of `ExtrudeGeometry.frame` for mutation or for
   identity-keyed state, and record the result in the progress log.
   Consumers include `faceFrame` (spreads), `scene.ts` `makeTool`,
   `sweptBounds` and `check.ts`. Expected: none mutates, and the only
   identity key is the extrema cache.

## Tests (`packages/core/src/cad/pcb-outline.test.ts`)

Imitate `measuredFixture` (`:105-185`): a board on a PCB page, Edge.Cuts
graphics and `cad.pcb` references, collected through `collectCadInput`.
Add a local helper `projectionFixture(m: number, k: number)`:
- one board whose Edge.Cuts form a single closed M-vertex polygon, for
  example M line segments around a convex polygon with integer
  coordinates;
- K references with thickness `i % 2 ? 1.8 : 1.0`.

- For M = K in 128, 256, 512 and 1024, reset
  `cadBoundsWork.vertexProjections` and run `checkCadPage(input, CAD_TEST_PAGE.id)`.
  -> no errors, and `vertexProjections === M` for K references and for
  the single-reference control (fails before: M x K).
- Smallest size, through `createCadGeometry` (or the history geometry
  accessor that the existing tests use):
  - each reference's span equals `{ t0: 0, t1: thickness }`;
  - `faceFrame(frame, span, "start")` has origin Z 0;
  - `faceFrame(frame, span, "end")` has origin Z equal to the thickness.
- Invalid extent: a polygon with one vertex at X = 10,001 mm, referenced
  twice -> two `cad.limit` errors, one per reference ID.
- Unedited and passing: the `:194` digest test (digest `f41508a2...`),
  `:224` and all other tests in the file.
- Fail-before: run the new projection test before change 2 (it shows
  M x K). Save the log as `fail-before.log`.

## Verification (each exits 0)

1. `bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/pcb-outline.test.ts`
2. `bun test packages/core/src/cad/pcb-outline.test.ts packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts`

## Done criteria

- Commands 1-2 exit 0.
- `fail-before.log` and the consumer audit are recorded.
- The diff stays inside writePaths.
- The progress log reads `done`.
