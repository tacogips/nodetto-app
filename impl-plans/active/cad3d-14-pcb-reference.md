# M14 cad3d-14-pcb-reference (type, outline, evaluation)

- dependsOn: M7 (`collectCadInput`, engine input), M2 (clipboard keep
  flag behaviour, `detach.test.ts` and `clipboard.test.ts`, which this
  plan extends); runs after M13 (shared files)
- Design: sections 3.2 (`cad.pcb`), 3.3 (cross-page reference), 6.3
  (outward sign), 8
- writePaths: `packages/ir/src/cad.ts`, `packages/ir/src/registry/cad.ts`,
  `packages/ir/src/cad.test.ts`, `packages/ir/src/registry.test.ts`
  (append `cad.pcb`), `packages/io/src/__fixtures__/cad3d.jsonl`,
  `packages/core/src/cad/pcb-outline.ts` (new) and its test,
  `packages/core/src/cad/evaluate.ts` and its test,
  `packages/core/src/cad/history.ts`, `packages/core/src/cad/frames.ts`
  (`faceOutwardSign` for `cad.pcb`), `packages/core/src/cad/engine.ts`
  (`collectCadInput`) and its test, `packages/core/src/shapes/cad.ts`,
  `packages/core/src/cad/detach.test.ts` (add the board row),
  `packages/cad-kernel/src/slice.test.ts`

## Contract

```ts
// packages/ir/src/cad.ts
export interface CadPcbSemantic { name: string; board?: ElementId; thickness?: number; suppressed?: boolean }
// packages/core/src/cad/pcb-outline.ts
export interface PcbOutline { readonly loops: readonly CadLoop[]; // CAD frame, mm, ccw, with depth
  readonly thickness: number; readonly sources: readonly ElementId[] }
export function pcbBoardOutline(elements: readonly Element[], boardId: ElementId):
  PcbOutline | { error: "cad.pcb.noBoard" | "cad.pcb.noOutline" | "cad.pcb.openOutline" };
```

## Behavior

- `cad.pcb` joins `CAD_ELEMENT_TYPES` (category `node`, keep flag);
  validator: `board` absent or a non-empty string, `thickness` optional,
  positive, on grid, at most 100. Reference `board` with policy `detach`.
- `pcbBoardOutline`: `elements` are those of the board's page. Collect
  `pcb.graphic` elements with `layer === "Edge.Cuts"` that are not hidden
  (same filter as `packages/core/src/pcb-board/export.ts:309-312`).
  Convert each shape (`PcbShape`, `packages/ir/src/pcb.ts:5-29`) to
  segments: line; arc through start, mid, end with `tessellateArc`; circle
  with `tessellateCircle`; rect as four segments; polygon as a closed
  chain. Chain open segments into loops by end points snapped to
  1 micrometre (`Math.round(v * 1000)` keys); a dangling end gives
  `cad.pcb.openOutline`. Map to the CAD frame with X = x - minX,
  Y = maxY - y over the outline bounds (same mapping as `export.ts:328`),
  orient ccw, compute even-odd depth. `sources[i]` is the graphic element
  id of each loop edge. Thickness: `cad.pcb.thickness`, else the board's
  `thickness`, else 1.6.
- Evaluation: a `cad.pcb` is a body creator with `reference: true`; tool =
  prisms of the loops on the `xy` base frame from 0 to thickness; face
  names `<id>:start`, `<id>:end`, `<id>:side:<graphicId>`. Sketches may use
  `{"face":{"feature":<id>,"role":"start"|"end"}}`; `history.ts` and
  `frames.ts` treat `cad.pcb` like an extrude with span (0, thickness), so
  `faceOutwardSign` is -1 for `start` and +1 for `end`. A feature whose
  `bodies` names a reference body gets `cad.body.reference` and is skipped
  (the board is never modified). Statuses: `cad.reference.missing` when
  `board` is absent or does not resolve to a `pcb.board`, and the three
  outline errors.
- `collectCadInput`: for every `cad.pcb` on the page, append the board
  element and the `pcb.graphic` elements of the board's page to
  `elements`. The evaluator recognises foreign elements by their page id
  and never treats them as CAD features. The content key of the board body
  hashes the canonical JSON of the collected outline graphics, the board
  thickness and the feature payload, so a board edit regenerates only this
  body and its dependants.
- Fixture: add a second page of kind `pcb` with a self-authored board and
  a rounded rectangle outline (four lines, four arcs) and one `cad.pcb`.

## Tests

- `pcb-outline.test.ts`: rectangle from four shuffled lines; rounded
  rectangle with arcs; circle board; outline with an inner cut-out (depth
  1); `rect` and `polygon` shapes; open outline, missing outline and
  missing board errors; Y flip (a point at the KiCad top maps to maximum
  Y); thickness precedence.
- `evaluate.test.ts`: a board body is created with `reference: true`;
  editing a graphic changes its key; editing an unrelated track does not;
  a cut naming the board gives `cad.body.reference` and issues no boolean.
- `engine.test.ts`: `collectCadInput` includes exactly the board and its
  `Edge.Cuts` graphics from the other page.
- `detach.test.ts`: deleting the board element, and deleting the whole PCB
  page, leave the `cad.pcb` without a `board` key; the document validates,
  round trips, the survivor accepts `updateSemantic`, undo restores it.
- Clipboard: `duplicatePage` of the CAD page keeps `board` (add to
  `packages/core/src/cad/clipboard.test.ts`, pre-authorised extension).
- `slice.test.ts` (real kernel): board 80 x 50 with corner radius 5 and
  thickness 1.6 has the analytic volume of the tessellated outline within
  1e-5; an enclosure base (rectangle 90 x 60 on a base sketch with offset
  -3, extruded 3, `op: "new"`) with a pocket (rectangle sketched on the
  board's `start` face, extruded with the sign given by `faceOutwardSign`,
  `op: "cut"`, `bodies` naming the enclosure) evaluates without errors and
  the enclosure volume drops by the pocket volume.
- `registry.test.ts` exact list gains `cad.pcb`; golden round trip stays
  byte identical; `label-field.test.ts` passes.

## Acceptance criteria

- A PCB page and a CAD page in one document give a live board body in the
  headless slice.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/ir/src packages/io/src/jsonl packages/core/src/cad packages/cad-kernel apps/cli/src/edit/label-field.test.ts'`
2. `sh -c 'mkdir -p tmp/cad3d/m14; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m14/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m14/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/pcb-outline.test.ts'`
3. `sh -c 'bunx biome check packages/core/src/cad packages/ir/src && bun test packages/core/src/cad/engine.test.ts'`
