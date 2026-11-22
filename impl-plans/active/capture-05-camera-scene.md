# M5 capture-05-camera-scene

- dependsOn: M19 (`packages/core/src/capture/` barrel)
- Design: sections 1.1 (fact 7), 6.1, 6.2, 6.7, 10.2
- writePaths: `packages/core/src/capture/camera.ts` (new) and its test,
  `packages/core/src/capture/scene.ts` (new) and its test,
  `packages/core/src/capture/determinism.test.ts` (new),
  `packages/core/src/capture/index.ts`
- Pre-authorised: none.

## Contract

```ts
// camera.ts
export type CaptureView = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom";
export interface CaptureCameraRequest { readonly view?: CaptureView; readonly direction?: Vec3;
  readonly eye?: Vec3; readonly target?: Vec3; readonly up?: Vec3; readonly zoom?: number;
  /** Millimetres of the model visible over the picture height; replaces fit and zoom (desktop current view). */
  readonly viewHeight?: number }
export interface CaptureCamera { readonly right: Vec3; readonly up: Vec3; readonly forward: Vec3;
  readonly centre: Vec3; readonly mmPerPixel: number; readonly view: CaptureView | "custom" }
export type Bounds3 = { readonly min: Vec3; readonly max: Vec3 };
/** Throws RangeError with a user message for a zero vector, parallel up, or zoom outside 0.01..1000. */
export function captureCamera(request: CaptureCameraRequest, bounds: Bounds3,
  size: { width: number; height: number }): CaptureCamera;
/** "cropped" when a corner of any box projects outside the picture. */
export function captureFrame(camera: CaptureCamera, boxes: readonly Bounds3[],
  size: { width: number; height: number }): "complete" | "cropped";

// scene.ts
export interface CaptureTool { readonly kind: "prism"; readonly feature: ElementId;
  readonly frame: CadFrame; readonly t0: number; readonly t1: number;
  readonly loops: readonly { readonly points: Float64Array; readonly faces: Uint32Array }[] }
export interface CaptureBody { readonly id: ElementId; readonly name: string; readonly reference: boolean;
  readonly steps: readonly { readonly op: "union" | "difference" | "intersection"; readonly tool: number }[];
  readonly bounds: Bounds3 }
export interface CadCaptureModel { readonly tools: readonly CaptureTool[]; readonly bodies: readonly CaptureBody[];
  readonly errors: readonly { id: ElementId; code: string }[]; readonly bounds: Bounds3 | null;
  readonly sketches: number; readonly skipped: readonly { id: ElementId; reason: "mesh" }[] }
export function buildCadCaptureModel(elements: readonly Element[], pageId: PageId): CadCaptureModel;
/** Design 6.1: keep a loop when its depth parity differs from its nearest selected ancestor's
 *  (no ancestor counts as odd). Exported for tests. */
export function normaliseToolLoops(loops: readonly CadLoop[]): readonly CadLoop[];
```

## Behavior

- `captureCamera`: design section 6.2 exactly. A named view is the
  integer vector of the table passed through the same normalisation as a
  custom direction (`iso` is `(-1,-1,-1)`); `direction`, or `eye` with
  `target` (default: centre of `bounds`), overrides `view` and yields
  `view: "custom"`. Default `up`: +Z, except when the normalised forward
  has `|x| <= 1e-9` and `|y| <= 1e-9`; then +Y for `forward.z < 0` and -Y
  for `forward.z > 0` (so a custom direction along Z equals `top` or
  `bottom`). `right = normalize(cross(forward, up))`, `up = cross(right,
  forward)`. Fit: project the eight corners of `bounds`; `centre` is the
  world point `right * cx + up * cy` (or the projection of `target` on
  the image plane); `mmPerPixel = max(spanX / width, spanY / height) *
  1.08 / zoom`, with a floor of `1e-6` for a degenerate span. With
  `viewHeight` (positive, at most 1e7) the scale is `viewHeight /
  height` instead and `zoom` must be absent. Only `+ - * /` and
  `Math.sqrt`.
- `captureFrame`: projects the corners of each box and compares with the
  half extents of the picture, with a slack of half a pixel.
- `normaliseToolLoops`: for each loop find its nearest selected ancestor:
  among the loops of smaller depth whose bounding box contains the loop's
  first vertex and whose polygon contains it (even-odd point test), the
  one with the greatest depth. Keep the loop when its depth parity
  differs from that ancestor's; without an ancestor keep it only when its
  depth is even. Loops are returned in input order. Bounding boxes are
  computed once; no recursion.
- `buildCadCaptureModel`: the walk of `checkCadPage`
  (`packages/core/src/cad/check.ts:57-137`, after M1), with the same
  input convention (page elements plus `pcb.board` and `pcb.graphic`
  elements of other pages) and the same functions (`scanCadPage`,
  `createCadGeometry`, `cadFailure`), so statuses equal `cad check` for
  every document:
  - sketch: store its frame and count it; extrude: build its geometry,
    normalise its loops, add one tool, then `new` creates a body, other
    ops append a step to each target body that exists; `cad.pcb`: a tool
    and a `reference` body; `cad.mesh`: no tool in this milestone, the
    feature is listed in `skipped` (M11 replaces this);
  - suppressed and failed features add nothing; a body whose creator
    element has `visual.hidden` is left out of `bodies` (its tools stay,
    nothing else refers to them), as exports skip hidden elements;
  - body name is `semantic.name` of the creator; body order is history
    order;
  - loop points are copied into one `Float64Array` per kept loop;
    `faces[i]` is `2 + k` where `k` numbers the distinct `loop.sources`
    of the tool in first-use order across its kept loops;
  - body bounds: the box of its union tools, from the swept vertices of
    the kept loops (the arithmetic of `includeTool`,
    `packages/core/src/cad/check.ts:22-55`); model bounds: the union over
    bodies, `null` without bodies;
  - `errors`: features whose status is not ok, sorted by id as
    `apps/cli/src/cad-command.ts:49-55` does.
  Linear passes apart from the ancestor search, flat arrays, no
  recursion, no per-point allocation.

## Tests

- `camera.test.ts`: each named view gives the expected orthonormal basis
  with `cross(right, up)` equal to `-forward`; `direction` and
  `eye`/`target` agree for the same line of sight; `direction 0,0,1`
  equals `bottom` and `0,0,-1` equals `top` exactly; a direction tilted
  by 1e-6 from Z uses +Z as up; custom `up`; errors; fit of a 100 x 60 x 5
  box in 1024 x 768 for `top` gives `mmPerPixel = 100 * 1.08 / 1024`;
  zoom 2 halves it; `viewHeight: 76.8` at height 768 gives 0.1;
  `target` moves the centre; `captureFrame` is
  `complete` for the fit and `cropped` with zoom 2 or a far target.
- `scene.test.ts` (self-authored documents built with the test helpers):
  Plate with a cut gives one body with two steps; an add and an intersect
  step; a cut naming two bodies appends to both; a failed sketch leaves
  the body without the step and lists the error; suppressed feature;
  hidden creator leaves the body out; a hole loop keeps one face id for a
  circle; bounds of body and model; a page with a `cad.pcb` gives a
  reference body; statuses equal `checkCadPage` for the same input on
  every case; `sketches` counts sketches on a page without a body; 20,000
  generated elements (`generateCadDocument`) build in under 1,000 ms in
  Bun.
- Loop rule (`scene.test.ts`), each compared on a 200 x 200 lattice of
  points with a reference written in the test from the kernel path's
  rule (deepest selected loop that contains the point has even depth,
  using each loop's depth as `buildLoops` reports it):
  - rectangle R, circle C1 inside, circle C2 inside C1; `loops: [C1, C2]`
    keeps only C2 (a disc); `loops: [R, C2]` keeps only R (no hole);
    `loops` absent keeps all three;
  - four nested loops with every subset of size two and three;
  - two islands inside a hole, one selected with the outer loop;
  - after normalisation "inside an odd number of kept loops" equals the
    reference at every lattice point.
- `determinism.test.ts`: parses every non-test file in
  `packages/core/src/capture` and fails on any `Math` member other than
  `sqrt`, `abs`, `min`, `max`, `floor`, `ceil`, `round`, `trunc`, `sign`,
  and on the `**` operator (the method of the existing check for
  `packages/core/src/cad`).

## Acceptance criteria

- The model for a page equals what `cad check` accepts and rejects.
- A tool's region equals the kernel path's region for every loop
  selection, with tests.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/capture packages/core/src/cad/check.test.ts'`
2. `sh -c 'mkdir -p tmp/capture/m05; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m05/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m05/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture'`
3. `sh -c 'bun run lint:ts && bun test packages/core/src/capture/scene.test.ts packages/core/src/capture/camera.test.ts'`

## Progress

Pending.
