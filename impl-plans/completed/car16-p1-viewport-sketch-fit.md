# car16-p1-viewport-sketch-fit

- planId: car16-p1-viewport-sketch-fit; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car16-p1-viewport-sketch-fit.md
- Finding: `function-cad-fit-ignores-visible-sketches` (medium).
- Design: `design-docs/specs/design-ai-capture.md` 32.1 R16-1, rules 1-4.
- Worker rules: `car16-00-overview.md`.
- Evidence: `tmp/car16-r16/car16-p1-viewport-sketch-fit/`.

## Intent and context

On a CAD page with visible sketch lines and no bodies, double-click Fit
and the initial fit frame the origin, so the drawing can be off-screen.
- `fit()` (`packages/ui-solid/src/cad/CadViewport.tsx:153-157`, bound at
  `:531`) passes only `drawnBodies()` to `fitBodies` (`:66-88`).
- The initial-fit effect (`:250-258`) requires `drawnBodies().length > 0`.

Fix: fit the visible sketch lines when no body is drawn. Keep every
body-page camera, published camera and fallback exactly as today.

Non-goals:
- Do not add sketch lines to the bounds when bodies are drawn.
- Do not touch `camera3d.ts`, `sketch-authoring.ts`, `sketch-overlay.ts`,
  `Canvas.tsx`, `apps/desktop/src/App.tsx` or picking.
- Do not change the low finding at `sketch-overlay.ts:306`.

## Changes (`packages/ui-solid/src/cad/CadViewport.tsx`)

1. Bounds source. Extend the bounds helper so it can also take sketch
   segment arrays: `sketch.entityLines()` items, `segments: Float32Array`
   of world xyz triples (`sketch-authoring.ts:185-205`). Reuse the
   per-axis min/max loop of `fitBodies`, with the same `undefined` guards.
   - A camera from bodies, or from lines, or from nothing goes through
     `fitBounds` unchanged.
2. `fit()`, kept as the double-click handler:
   - It still returns early when `sketch.drawing()`.
   - If `drawnBodies().length > 0`, fit the bodies only (today's result,
     bit-identical).
   - Otherwise, if any entity line has segments, fit those endpoints.
   - Otherwise fit nothing (today's fallback).
   - It still publishes through `changeCamera`, which sets `fitted` and
     calls `onCameraChange`.
3. Initial-fit effect:
   - It does nothing while `fitted`, a zero size or `sketch.drawing()`
     holds.
   - Bodies drawn: call `fit()`, as today. This is the body fit and it is
     published.
   - No body, visible lines, and no provisional fit yet in this mount:
     make the provisional fit. It calls `setCamera(...)` directly. It
     does NOT call `changeCamera` or `onCameraChange`, and it does NOT
     set `fitted`. Record a local `let provisional = true` so it happens
     at most once per mount. Later sketch edits must not move the camera.
   - Because `fitted` stays false, the first time bodies are drawn the
     effect runs the published body fit once.
   - Any user camera change already goes through `changeCamera`, which
     sets `fitted = true`, so a later body arrival does not move the
     camera. This covers orbit, pan, zoom, dblclick and `alignToFrame`.
4. `initialCamera` handling (`:101-105`) is unchanged: when supplied,
   `fitted` is true and no initial fit runs.

Pitfalls:
- Wrong approach: publishing the provisional camera. `NodettoCanvas`
  caches every published camera (`Canvas.tsx:144`, `:186-190`) and
  passes it back as `initialCamera`, which would suppress the body fit
  after a page switch.
- `sketch.entityLines()` already skips hidden sketches, hidden entities
  and unresolved frames. Do not re-implement that filter.
- Make sure the effect tracks `sketch.entityLines()` only when it is
  needed, so ordinary body pages do not refit on sketch changes.

## Tests

`packages/ui-solid/src/test-dom/cad-viewport.dom.tsx`. Imitate the
existing loop: the `createRenderer` stub with `cameras` recorded in
`draw`, `point`/`movePointer`, `painted`, and `respond`.
- Make the `getBoundingClientRect` stub read a module-level size
  variable, default 400 x 400. Existing cases keep 400 x 400.
- Build the documents with `cadElement`, `sketch` and `rectangle` from
  `../../../core/src/cad/testing/documents.ts`. The page id is `cad`.
- Use the exported `viewProjection` and `fitBounds` from
  `../cad/camera3d.ts`. `viewProjection` is column-major: clip =
  M * [x, y, z, 1], and NDC = clip.xy / clip.w.

Cases (new cases run after the existing theme loop and log
`ok sketch fit` at the end):
- Sketch-only, 800 x 600. One `xy` sketch with
  `rectangle(id, 590, -610, 20, 20)` and no extrude. The engine stub
  answers `{ bodies: [] }`.
  - After paint, all 4 corners (z = 0) of the last drawn camera are in
    NDC [-1, 1] in X and Y. Fails before the fix.
  - Middle-button `movePointer(canvas, 35, 35, 1)` changes the target.
    A real `dblclick` then gives a camera whose corners are again in
    NDC [-1, 1].
- Hidden sketch. The same page plus a second sketch spread with
  `visual: { hidden: true }`, holding `rectangle(..., 5000, 5000, 20, 20)`.
  The initial drawn camera deep-equals the sketch-only case's initial
  camera.
- Empty CAD page, 800 x 600, no sketch, no body. `dblclick` gives a
  camera that deep-equals `fitBounds([-50, -50, -50], [50, 50, 50], 800 / 600)`.
- Page switch with a deferred body. Fresh `render`, 400 x 400,
  `plateWithHoles()` plus the `drawing` page, and an `onCadCameraChange`
  spy array.
  1. Mount on `cad`. Leave request 0 unanswered and paint. The last drawn
     camera does not deep-equal
     `fitBounds([-20, -20, 0], [20, 20, 0], 1)`, and the spy is empty.
  2. `editor.setCurrentPage("drawing")`, then `"cad"`. A new request is
     sent. Leave request 0 unanswered, or reject it with
     `CadSupersededError`.
  3. Resolve the new request with `{ bodies: [body] }` and paint. The last
     drawn camera deep-equals
     `fitBounds([-20, -20, 0], [20, 20, 0], 1)`, and the spy's first
     entry is `["cad", that camera]`.
  Before the fix, step 1's "differs" assertion fails. That is expected:
  this case guards rule 3 after the fix.
- Existing assertions stay unedited: the body `fitted` and centre pick,
  dblclick back to `fitted`, and `savedCamera` on remount (`:273-285`).
- Clean up each render (`dispose`, `root.remove()`, restore
  `elementFromPoint`) as the existing loop does.

`packages/ui-solid/src/cad/viewport.test.tsx`: in the first test, add
`expect(output).toContain("ok sketch fit");`.

## Verification (each exits 0)

1. Fail-before: run command 2's `bun test` part before editing
   `CadViewport.tsx`. Expect exit 1 on the sketch-only corner assertion.
   Save it as `fail-before.log`.
2. `export CARGO_TARGET_DIR=target/r16-viewport-fit && bunx biome check packages/ui-solid/src/cad/CadViewport.tsx packages/ui-solid/src/test-dom/cad-viewport.dom.tsx packages/ui-solid/src/cad/viewport.test.tsx && bun test packages/ui-solid/src/cad/viewport.test.tsx -t 'CAD viewport mounts'`
   - It must report 1 test passed. The output contains `ok light`,
     `ok dark` and `ok sketch fit`. Save it as `gate.log`.
3. `bun test packages/ui-solid/src/cad/viewport.test.tsx` (both DOM
   tests, including the sketch tool test) exits 0. Save it as
   `viewport-all.log`.

## Done criteria

- [x] Commands 2 and 3 exit 0, and `fail-before.log` shows exit 1.
- [x] Every file this plan edited is in its writePaths. Check this with the
      pre/post hashes; siblings edit other files in the same tree.
- [x] No existing assertion is changed or removed.
- [x] The progress log reads `done`, with hashes and logs.
