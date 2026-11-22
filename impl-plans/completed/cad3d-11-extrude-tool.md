# M11 cad3d-11-extrude-tool

- dependsOn: M10 (authoring builders, sketch selection, overlay lines)
- Design: sections 5, 6.3 (outward sign), 6.4 (preview and commit), 3.2
- writePaths: `packages/core/src/cad/authoring.ts` and its test,
  `packages/core/src/cad/preview.ts` (new) and its test,
  `packages/ui-solid/src/cad/extrude-interaction.ts` (new) and its test,
  `packages/ui-solid/src/cad/CadViewport.tsx`,
  `packages/ui-solid/src/cad/renderer.ts` (translucent preview mesh input),
  `packages/ui-solid/src/cad/viewport.test.tsx`

## Contract

```ts
// packages/core/src/cad/authoring.ts
export function defaultExtrude(elements: readonly Element[], sketchId: ElementId):
  { op: "new" | "add" | "cut"; bodies: readonly ElementId[]; distance: number };
export function extrudeIntent(elements: readonly Element[], sketch: Element, distance: number): CadExtrudeSemantic["op"];
export function extrudeCommands(pageId: PageId, sketch: Element, params: { distance: number;
  op: CadExtrudeSemantic["op"]; bodies: readonly ElementId[]; name: string }, ids: CadIds): { id: ElementId; commands: Command[] };
// packages/core/src/cad/preview.ts (kernel-free)
export function extrudePreviewMesh(elements: readonly Element[], extrude: CadExtrudeSemantic, id: ElementId):
  { positions: Float32Array; indices: Uint32Array } | { error: string };
// packages/ui-solid/src/cad/extrude-interaction.ts (pure)
export interface ExtrudeDrag { readonly startDistance: number; readonly distance: number }
export function dragDistance(frame: CadFrame, camera: Camera3d, aspect: number,
  from: { x: number; y: number }, to: { x: number; y: number }, start: number): number; // snapped to 0.1 mm
```

## Behavior

- `defaultExtrude`: a sketch on a base plane gives `new` with distance
  +10. A sketch on a face of feature F gives `add` on `faceBody(F face)`
  (M4: F itself for `new`, else the first existing body in F's `bodies`),
  with `distance = 10 * faceOutwardSign(...)` so the boss grows out of the
  body's material on every kind of face (start cap, end cap of a negative
  extrude, side faces in either line direction, hole sides, and the floor
  and walls of a pocket made by a cut feature, where the sign includes the
  operation factor); when the sign is 0 or `faceBody` is null it falls
  back to `new` and +10. The new
  feature's index is right after the sketch's last entity.
- `extrudeIntent(elements, sketch, distance)`: for a face sketch,
  `distance * faceOutwardSign > 0` returns `"add"` and `< 0` returns
  `"cut"`; for a base sketch it returns the current `op`.
- `extrudePreviewMesh`: `buildLoops` and `prismTool` for every loop,
  concatenated (holes are shown as separate prisms; no boolean), so a
  preview costs no kernel call.
- Tool flow: with a sketch selected, choosing `cad:extrude` applies
  `extrudeCommands(defaultExtrude(...))` once and selects the new feature.
  Dragging the viewport arrow handle (a line along the sketch normal drawn
  by the overlay) changes a local signal only; the renderer shows
  `extrudePreviewMesh` translucently with the highlight colour; pointer up
  applies one `updateSemantic` with the final distance (none when
  unchanged). Typing in the inspector uses M9.
- `dragDistance`: projects the pointer movement on the screen direction of
  the frame normal; negative values allowed; zero is replaced by the
  smallest step with the previous sign so the validator never rejects it.
- "Sketch on face" entry: the context action or the `cad:sketch` tool with
  a stored face pick (M10) is confirmed here by an end-to-end test.
- Cut convenience: while dragging a face-sketch extrude whose `op` is
  `add` or `cut`, the committed command sets `op` to
  `extrudeIntent(...)`, so dragging into the body cuts and dragging out
  adds, whatever the frame normal of that face is. `new` and `intersect`
  are never changed by a drag.

## Tests

- `authoring.test.ts`: `defaultExtrude` for first sketch and second base
  sketch; for a sketch on each of: the end face of a +5 plate, its start
  face, the end face of a -5 plate, a side face whose line is stored
  forward, one stored reversed, a side face of a rectangular hole, and the
  floor and one wall of a pocket cut 2 mm into the plate's end face (floor:
  default distance +10 along the frame normal that points into the open
  pocket, `add` on the plate).
  `extrudeIntent` for both drag directions on each. Commands validate
  through `applyCommands`.
- `preview.test.ts`: plate with two holes gives three prisms' triangle
  counts; an open profile gives `{ error: "cad.profile.open" }`.
- `extrude-interaction.test.ts`: drag along and against the projected
  normal, snapping, zero avoidance.
- `viewport.test.tsx`: scripted drag produces zero commands during the
  drag and exactly one `updateSemantic` at pointer up; undo restores the
  previous distance.
- End to end with the real kernel, placed in
  `packages/cad-kernel/src/slice.test.ts` (pre-authorised extension):
  build the Plate entirely through the authoring builders (sketch,
  rectangle, extrude, face sketch, circles, extrude with negative distance
  as cut), evaluate, compare the volume with the analytic value, change the
  cut circle radius, re-evaluate, undo, re-evaluate. Outward sign against
  the kernel: for each of the eight face cases above (six on `new` plates,
  pocket floor and pocket wall), a circle boss created
  with `defaultExtrude` increases the body volume by the full prism volume
  (it lies entirely outside the material), and the same sketch with the
  opposite distance and `extrudeIntent` gives `cut` and decreases the
  volume. Pocket floor in numbers: plate 100 x 60 x 5, pocket 40 x 20 x 2;
  a boss of radius 3 and default distance on the floor adds
  `polygonArea * 10` (it rises from z 3 to z 13 inside and above the
  pocket, touching no plate material), and the opposite drag by 1 mm cuts
  `polygonArea * 1` out of the floor. The design example of section 7.2 (cut with distance -5 on the
  end face of a +5 plate) removes the hole volume.

## Acceptance criteria

- The complete user flow of acceptance criterion 3 (build, edit a
  parameter, regenerate, undo and redo) is covered by automated tests
  without manual steps.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad packages/ui-solid/src/cad packages/cad-kernel/src/slice.test.ts'`
2. `sh -c 'bunx biome check packages/core/src/cad packages/ui-solid/src/cad && bun test packages/ui-solid/src/cad/extrude-interaction.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m11; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m11/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m11/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/preview.test.ts'`
