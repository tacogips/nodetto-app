# breadboard-11-ui-shape-views

- planId: breadboard-11-ui-shape-views
- planPath: impl-plans/completed/breadboard-11-ui-shape-views.md
- wave: 5; dependsOn: breadboard-08-core-notation-svg (wave 4),
  breadboard-15-ui-export-dialog (checkpoint amendment 2: plan 15 pins bun
  to 1.4.0 in mise.toml; run `test "$(bun --version)" = "1.4.0"` before any
  gate and report a blocker instead of running gates if it fails)
- design: design-docs/specs/design-breadboard.md section 7.1 (canvas
  renders the same primitives as SVG export)
- progress log: impl-plans/progress/breadboard-11-ui-shape-views.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/ui-solid/src/shapes/(BreadboardShapeView\.tsx|breadboard-view(\.test)?\.ts|ShapeView\.tsx)`

## Completion (session-490)

- Status: COMPLETE. Accepted by test-integrity, adversarial and the
  session-490 serial integration review (comm-009184, all 18 plans on the
  combined tree); archived to `impl-plans/completed/` in Step 8.
- Combined-tree verification: `mise exec -- bun run typecheck` exit 0;
  `mise exec -- bun test --path-ignore-patterns 'tmp/**'` exit 0 (2501 pass,
  18 skip, 0 fail); `CARGO_TERM_QUIET=true mise run lint` exit 0;
  `CARGO_TERM_QUIET=true mise exec -- cargo test --workspace` exit 0.
  Evidence (local, untracked): `tmp/breadboard-mode-s485/reconcile-s490/`.
- Open item owned by `breadboard-00-overview`, which stays in
  `impl-plans/active/`: `CARGO_TERM_QUIET=true mise run verify` exited 1
  because its `bun test` also collects git-ignored scratch copies under
  `tmp/breadboard-mode-s485/breadboard-05-collab/`
  (RECON-S490-W1-VERIFY-TMP-SCRATCH).
- Known low residual (S7-11-L1): `Canvas.tsx` never passes
  `breadboardInert`, so with two or more netlist cards the secondary card is
  dimmed in SVG export but not on the canvas.
- The sections below are the dispatch-time plan.

## Intent

Render breadboard elements on the canvas from `breadboardNotation` (plan
08), so the canvas and SVG export draw identical artwork. Labels stay
upright at every rotation.

## Non-goals

- No net highlight, ratsnest or wire-draft overlays. Those are plan 12.
- No new artwork. Use only the primitives from plan 08.

## writePaths

- packages/ui-solid/src/shapes/BreadboardShapeView.tsx (new)
- packages/ui-solid/src/shapes/breadboard-view.ts (new: pure view-model helpers)
- packages/ui-solid/src/shapes/breadboard-view.test.ts (new)
- packages/ui-solid/src/shapes/ShapeView.tsx
- impl-plans/progress/breadboard-11-ui-shape-views.md

## sharedPaths

none

## Contracts

```ts
// breadboard-view.ts
export interface BreadboardViewModel { body: readonly BreadboardPrimitive[]; labels: readonly BreadboardPrimitive[]; labelTransform: string | undefined }
export function breadboardViewModel(element: Element, box: Box, inert: boolean): BreadboardViewModel;
```

`labelTransform` is `rotate(-r cx cy)` in box-local coordinates when
`visual.rotation` r is non-zero, otherwise `undefined`. It cancels the
container rotation that `ShapeView` already applies, which matches the SVG
export drawing labels outside the rotation group.

## File-level changes

- `BreadboardShapeView.tsx`: imitate `BpmnShapeView.tsx` and reuse
  `BpmnNotationPrimitiveView` / `primitiveAttributes`
  (`packages/ui-solid/src/shapes/bpmn-primitive.ts:12`) to draw each
  primitive. Add `class={"breadboard-" + role}` to each node. Draw the body
  in an `<svg>` sized to the box, and the labels in a `<g>` with
  `labelTransform`. Use `overflow: visible` so labels above the box show.
- Compute `inert` with `breadboardTargetNetlist(editor snapshot, page)`
  from `@nodetto/core`: the card is inert when it is not the active one.
  If the view props have no store access, add an optional `inert?: boolean`
  prop and compute it in `ShapeView.tsx`, which can read the element's
  page through existing props or context. Pick whichever matches how
  other views read document state, and record the choice.
- `ShapeView.tsx`: add
  `<Match when={isBreadboardElementType(props.element.type)}>` next to the
  BPMN match (ShapeView.tsx:173).

## Pitfalls

- Do not rotate the body yourself. `ShapeView` already wraps the element
  in its rotation.
- Wires: the box is the wire's point bounds from the shape util. The
  primitives are already relative to that box.
- Keep every other view unchanged. Existing ui-solid tests must pass
  unchanged.

## Tests (input -> expected), in `breadboard-view.test.ts`

- resistor at rotation 0 -> `labelTransform` undefined, and body roles
  include `resistor-band-0`
- resistor at rotation 90 with a 50x10 box -> `labelTransform` equals
  `rotate(-90 25 5)`
- half board -> 400 body primitives with role `board-hole`
- `inert: true` netlist card -> its primitives carry opacity 0.5
- the primitive count for each of the 13 types equals
  `breadboardNotation(...).body.length` (no dropping)

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-11-ui-shape-views
bun test packages/ui-solid/src/shapes/breadboard-view.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/ui-solid > tmp/breadboard-mode-s485/breadboard-11-ui-shape-views/ui.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-11-ui-shape-views/typecheck.log 2>&1     # G1
bunx biome check packages/ui-solid/src/shapes/BreadboardShapeView.tsx packages/ui-solid/src/shapes/breadboard-view.ts packages/ui-solid/src/shapes/breadboard-view.test.ts packages/ui-solid/src/shapes/ShapeView.tsx   # exit 0
```

## Done criteria

- `grep -n 'isBreadboardElementType' packages/ui-solid/src/shapes/ShapeView.tsx` prints a line.
- All verification lines pass, with exit codes and counts in the progress log.
