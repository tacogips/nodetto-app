# M4 cad3d-04-core-evaluate

- dependsOn: M3 (frames, loops, tessellation, triangulation)
- Design: sections 3.3, 3.4, 6.1 (port), 6.3, 6.5, 6.6
- writePaths (all new, under `packages/core/src/cad/`): `history.ts`,
  `tool-solid.ts`, `kernel.ts`, `keys.ts`, `evaluate.ts`,
  `testing/recording-kernel.ts`, `testing/documents.ts`, matching
  `*.test.ts`; plus exports in `packages/core/src/cad/index.ts`

## Intent

Everything between "elements of a CAD page" and "calls on a kernel":
ordering, dependency statuses, named tool solids, and a memoised driver.

## Contract

```ts
// kernel.ts
export interface ToolMesh { readonly positions: Float64Array; // xyz mm
  readonly triangles: Uint32Array; readonly triFace: Uint32Array; // index into faceNames
  readonly faceNames: readonly string[] }
export interface KernelMesh { readonly positions: Float32Array; readonly triangles: Uint32Array;
  readonly triFace: Uint32Array; readonly faceNames: readonly string[] }
export type KernelHandle = number;
export interface CadKernel { readonly id: string;
  solid(mesh: ToolMesh): KernelHandle;
  boolean(op: "add" | "cut" | "intersect", target: KernelHandle, tools: readonly KernelHandle[]): KernelHandle;
  mesh(handle: KernelHandle): KernelMesh;
  measure(handle: KernelHandle): { volume: number; area: number; empty: boolean; triangles: number };
  release(handle: KernelHandle): void }
// history.ts
export type CadStatus = { readonly ok: true } | { readonly ok: false; readonly code: string; readonly detail?: string };
export interface CadHistory { readonly features: readonly Element[]; // history order
  readonly entitiesOf: (sketchId: ElementId) => readonly Element[];
  readonly status: ReadonlyMap<ElementId, CadStatus> } // structural statuses only
export function analyzeCadPage(elements: readonly Element[]): CadHistory;
// tool-solid.ts
export function faceName(feature: ElementId, role: "start" | "end" | "side", entity?: ElementId): string;
export function prismTool(loop: CadLoop, frame: CadFrame, span: { t0: number; t1: number },
  feature: ElementId): ToolMesh;
// keys.ts
export function contentKey(parts: readonly string[]): string; // 16 hex chars, two 32-bit FNV-1a passes
// evaluate.ts
export interface CadBodyResult { readonly id: ElementId; readonly handle: KernelHandle;
  readonly key: string; readonly reference: boolean }
export interface CadEvaluation { readonly bodies: readonly CadBodyResult[];
  readonly status: ReadonlyMap<ElementId, CadStatus> }
export interface CadMemo { /* opaque LRU of key -> handle */ }
export function createCadMemo(kernel: CadKernel, limits?: { entries?: number; triangles?: number }): CadMemo;
export function faceOutwardSign(elements: readonly Element[], face: CadFaceRef): 1 | -1 | 0; // in history.ts
export function evaluateCadPage(elements: readonly Element[], kernel: CadKernel, memo: CadMemo): CadEvaluation;
```

## Behavior

- History order: features (`cad.sketch`, `cad.extrude`, later body types)
  sorted by `index` with `compareFractional`, then id. Entities are grouped
  by `semantic.sketch`.
- Structural statuses: `cad.reference.missing` (reference key absent
  after a detach, unknown id, wrong type or other page), `cad.body.missing`
  (`op` is not `new` and `bodies` is absent, empty or names no earlier body
  creator), `cad.profile.empty` (`loops` present and empty),
  `cad.order.forward` (reference to a later feature),
  `cad.cycle`, `cad.plane.notPlanar` (side face of an arc or circle),
  `cad.limit` (more than 20,000 CAD elements). Every detached shape of the
  design section 3.2 table maps to the status named there; none throws.
- `faceOutwardSign` resolves the face's feature, its span and (for a side
  face) the loop of the entity, takes `capOutwardSign` or
  `sideOutwardSign` of M3 as the tool factor and multiplies it by the
  operation factor of the defining feature: -1 when its `op` is `cut`, +1
  for `new`, `add`, `intersect` and for body creators without an `op`
  (design 6.3). 0 when anything does not resolve.
- `faceBody(elements, face): ElementId | null` (exported from
  `history.ts`): the feature itself for `new`; otherwise the first id in
  its `bodies` that names an earlier body creator; null when none. A feature that
  depends on a failed feature gets `cad.reference.failed`.
- Frame of a sketch: base frame, or `faceFrame` of the referenced extrude
  computed from that extrude's sketch frame (recursive through history,
  iterative implementation, memoised per evaluation).
- Extrude: `buildLoops` (with `loops` as pick) then one `prismTool` per
  loop. Face names: `faceName(id,"start")`, `faceName(id,"end")`,
  `faceName(id,"side",entityId)`. Tool = union of even depth prisms cut by
  odd depth prisms, deeper levels alternating. `new` creates body `id`;
  `add` unions the tool into its single target; `cut` and `intersect` apply
  to each listed body. An empty result is `cad.result.empty` and the body
  keeps its previous state. `suppressed` and failed features are skipped.
- Keys: sketch key = `contentKey` of the canonical JSON of the sketch and of
  its entities sorted by id; tool key adds the extrude payload, kernel id
  and tessellation constants; body state key chains the previous state key
  and the tool key. The memo returns the stored handle for a known key and
  evicts least recently used entries, releasing their handles, while it
  holds more than 256 entries or more than 4,000,000 triangles in total
  (triangle counts from `measure`); entries used by the current evaluation
  are never evicted during it. Kernel exceptions become
  `cad.kernel.failed` for that feature.
- `testing/recording-kernel.ts`: a `CadKernel` that records calls and
  returns synthetic handles (no geometry); `testing/documents.ts`: builders
  for self-authored documents (Plate with holes, Boss on face).

## Tests

- `history.test.ts`: order by index then id; each status code from a
  minimal document; one case per detached shape of design 3.2 (payload
  written as the delete rewrite leaves it); `faceOutwardSign` for the end
  face of a positive and of a negative extrude, the start face, a side
  face of a reversed line and a hole side; and for faces made by a cut:
  Plate `new` +5, Pocket `cut` -2 from the plate's end face: the pocket
  floor (`end` of the cut) gives +1 and a pocket wall drawn forward on the
  counter-clockwise loop gives -1 (the body lies outside the pocket); the
  same faces with `op: "intersect"` give the unflipped values; `faceBody`
  for `new`, for a cut naming two bodies (first one) and for a cut with
  empty `bodies` (null); deleting a sketch leaves the extrude with
  `cad.reference.missing` and later features still analysed.
- `tool-solid.test.ts`: prism of a rectangle has 12 triangles, 6 face names,
  outward orientation (positive signed volume = area times height), and
  for negative distance too.
- `evaluate.test.ts` with the recording kernel: Plate with six holes issues
  1 + 6 `solid`, the expected booleans, and one body; a second evaluation
  of the same elements issues no kernel call; changing one hole radius
  re-issues only that hole's `solid` and the booleans after it; changing an
  unrelated later body leaves the plate's calls at zero; evicted handles
  are released exactly once; with a triangle limit of 100 and a recording
  kernel reporting 60 triangles per solid, at most one finished body state
  stays cached.

## Acceptance criteria

- Contract exported; no import of DOM, Worker or WASM in these files.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad'`
2. `sh -c 'bunx biome check packages/core/src/cad && bun test packages/core/src/cad/evaluate.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m4; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m4/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m4/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/history.test.ts'`
