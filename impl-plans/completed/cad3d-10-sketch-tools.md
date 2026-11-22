# M10 cad3d-10-sketch-tools

- dependsOn: M9 (feature list and selection of sketches)
- Design: section 5 (sketch mode), 6.3 (frames), 6.4 (commit rule)
- writePaths: `packages/core/src/cad/authoring.ts` (new) and its test,
  `packages/ui-solid/src/cad/sketch-interaction.ts` (new),
  `packages/ui-solid/src/cad/sketch-snap.ts` (new),
  `packages/ui-solid/src/cad/sketch-overlay.ts` (new), their tests,
  `packages/ui-solid/src/cad/CadViewport.tsx`,
  `packages/ui-solid/src/cad/renderer.ts` (line overlay input only)

## Contract

```ts
// packages/core/src/cad/authoring.ts (pure command builders; ids and indexes are passed in)
export interface CadIds { next(): ElementId; indexAfter(previous: string | undefined): string }
export function sketchCommands(pageId: PageId, plane: CadPlane, name: string, ids: CadIds, after?: string): { id: ElementId; commands: Command[] };
export function lineCommands(pageId: PageId, sketch: Element, a: CadXY, b: CadXY, ids: CadIds): Command[];
export function rectangleCommands(pageId: PageId, sketch: Element, p: CadXY, q: CadXY, ids: CadIds): Command[]; // four lines
export function circleCommands(pageId: PageId, sketch: Element, c: CadXY, r: number, ids: CadIds): Command[];
export function arcCommands(pageId: PageId, sketch: Element, a: CadXY, m: CadXY, b: CadXY, ids: CadIds): Command[];
export function sketchFrameOf(elements: readonly Element[], sketchId: ElementId): CadFrame | null;
// packages/ui-solid/src/cad/sketch-interaction.ts (pure state machine)
export type SketchTool = "cad:line" | "cad:rect" | "cad:circle" | "cad:arc";
export type SketchEvent = { type: "down" | "move" | "up"; p: CadXY } | { type: "escape" };
export interface SketchState { readonly tool: SketchTool; readonly points: readonly CadXY[]; readonly hover?: CadXY }
export function sketchStep(state: SketchState, event: SketchEvent):
  { state: SketchState; commit?: { kind: "line" | "rect" | "circle" | "arc"; points: readonly CadXY[] } };
// sketch-snap.ts
export function snapSketchPoint(p: CadXY, context: { grid: number; endpoints: readonly CadXY[];
  anchor?: CadXY; tolerance: number }): { p: CadXY; kind: "endpoint" | "axis" | "grid" };
// sketch-overlay.ts
export function sketchOverlaySegments(frame: CadFrame, entities: readonly Element[], preview?: readonly number[]): Float32Array; // xyz pairs
```

## Behavior

- Entity index: `ids.indexAfter` of the last entity of that sketch, else of
  the sketch itself, so entities sort right after their sketch.
- Rectangle: four `cad.line` elements sharing corner coordinates exactly,
  in one command list (one undo step). A zero width or height commits
  nothing.
- `sketchStep`: line = down, down (chain continues from the last point
  until escape or a click on the first point of the chain); rect = down,
  up or down, down (two corners); circle = centre then radius point; arc =
  start, end, mid point. `escape` clears points; a second `escape` is
  reported by returning the state unchanged with no points so the caller
  can leave the tool.
- Snap priority: end point within tolerance, then horizontal or vertical
  alignment with the anchor, then the grid (1 mm default, 0.1 mm with a
  modifier). Output coordinates always pass `roundNm`.
- `CadViewport` wiring: choosing the `cad:sketch` tool creates a sketch on
  the `xy` base plane, or on the picked planar face when a face pick is
  stored (`plane.face` with role and entity taken from the face name; side
  faces of arcs and circles are refused with a status message), selects it
  and aligns the camera to its frame. With a sketch (or one of its
  entities) selected and a sketch tool active, pointer positions are
  intersected with the sketch plane (`screenRay` and `sketchFrameOf`),
  converted to 2D, snapped, fed to `sketchStep`; a `commit` becomes the
  matching command list applied once. The overlay draws the sketch's
  entities (tessellated with the M3 functions) in the theme's `line`
  colour, construction entities dashed, and the pending preview and the
  active sketch in the `highlight` colour (`CAD_THEME_TOKENS`, M8).
- Escape with no pending points switches to the select tool through the
  existing tool API.

## Tests

- `authoring.test.ts`: each builder's commands apply through
  `applyCommands` on a CAD page and validate; rectangle gives four lines
  forming one loop in `buildLoops`; `sketchFrameOf` on a face sketch equals
  `faceFrame` of M3; builders on a non-CAD page fail with
  `page.contentKind` (rule R end to end).
- `sketch-interaction.test.ts`: event scripts for all four tools, chain
  closing, escape semantics, zero-size rectangle.
- `sketch-snap.test.ts`: endpoint beats axis beats grid; results on grid.
- `sketch-overlay.test.ts`: segment count for a rectangle and a circle;
  points lie on the frame plane.
- `viewport.test.tsx` additions: with fakes, a scripted line draw applies
  exactly one command batch and one history entry.

## Acceptance criteria

- A rectangle and a circle can be drawn on a base plane sketch and on a
  face sketch, each as a single undo step.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad/authoring.test.ts packages/ui-solid/src/cad'`
2. `sh -c 'bunx biome check packages/core/src/cad packages/ui-solid/src/cad && bun test packages/ui-solid/src/cad/sketch-interaction.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m10; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m10/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m10/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/authoring.test.ts'`
