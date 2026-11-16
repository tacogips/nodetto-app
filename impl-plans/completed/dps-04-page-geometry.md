# dps-04-page-geometry

- planId: dps-04-page-geometry. Wave 1. dependsOn: none.
- Design: sections 5.1 (presets and identity), 5.3 (geometry, add and reflow
  plans, navigation reference) and 7.1 (page sequence) of
  `design-docs/specs/design-document-pages-snippets.md`.
- File location: the design names `document-export/sequence.ts`, but this
  plan places the sequence at `page-frames/sequence.ts`. The behaviour is
  the same; the move keeps one owner per directory in wave 1.
- writePaths:
  - New files:
    - `packages/core/src/page-frames/presets.ts`
    - `packages/core/src/page-frames/order.ts`
    - `packages/core/src/page-frames/plan.ts`
    - `packages/core/src/page-frames/navigation.ts`
    - `packages/core/src/page-frames/sequence.ts`
    - `packages/core/src/page-frames/index.ts`
    - `packages/core/src/page-frames/presets.test.ts`
    - `packages/core/src/page-frames/order.test.ts`
    - `packages/core/src/page-frames/plan.test.ts`
    - `packages/core/src/page-frames/navigation.test.ts`
    - `packages/core/src/page-frames/sequence.test.ts`
  - Logs and artifacts: `impl-plans/progress/dps-04-page-geometry.md`,
    `tmp/dps-s861/dps-04-page-geometry`, `target`.
- sharedPaths: `packages/core/src/index.ts`. Append exactly one line:
  `export * from "./page-frames/index.ts";`.
- artifactRoots: `target`.

## Intent and context

This plan provides the pure page-frame geometry used by:

- editing and UI (dps-11);
- the slideshow (dps-12);
- document export (dps-14).

dps-03 adds `FrameSemantic.page` and `Page.pageFlow` in the same wave, so
this plan reads both structurally. Do not import `PageFrameSpec` or
`PageFlow` from `@nodetto/ir`. Declare local structural types:
`{ size: string; orientation: "portrait" | "landscape" }` and
`"vertical" | "horizontal"`.

## Non-goals

- No `Editor` usage. The editor facade belongs to dps-11.
- No UI, export rendering or `updatePage` command construction. `pageFlow`
  commands belong to dps-11 after dps-03 lands.

## Contract

```ts
export const PAGE_FRAME_GAP = 48;
export const PAGE_FRAME_PRESETS: readonly { id: string; label: string; portrait: { width: number; height: number }; defaultOrientation: "portrait" | "landscape" }[];
export function pageFrameSize(size: string, orientation: "portrait"|"landscape", current?: { width: number; height: number }): { width: number; height: number };
export function pageFramePresetOf(box: { width: number; height: number }, page: { size: string; orientation: string } | undefined): string; // preset id or "custom"
export function pageFlowOf(page: { pageFlow?: unknown } | undefined): "vertical" | "horizontal";
export function isPageFrame(element: Element): boolean;            // type frame && semantic.page is an object
export function pageFramesInFlowOrder(store: Store, registry: ShapeUtilRegistry, pageId: PageId): Element[]; // top-level page frames only
export function planShiftPageFrames(store: Store, registry: ShapeUtilRegistry, frames: readonly { id: ElementId; dx: number; dy: number }[]): Command[];
export function planAddPageFrameGeometry(input: {...}): { x: number; y: number; width: number; height: number; size: string; orientation: "portrait"|"landscape"; shifted: { id: ElementId; dx: number; dy: number }[] };
export function planReflowPageFrames(frames: readonly { id: ElementId; x: number; y: number; width: number; height: number }[], flow: "vertical"|"horizontal"): { id: ElementId; dx: number; dy: number }[];
export function referencePageFrame(frames: readonly Element[] /* flow order */, boxes: ReadonlyMap<ElementId, Box>, center: Vec, selected: ElementId | null): ElementId | null;
export function neighbourPageFrame(frames: readonly Element[], from: ElementId, direction: "next" | "previous"): ElementId | null;
export interface DocumentPageRef { pageId: PageId; frameId?: ElementId; rect: Box }
export function documentPageSequence(store: Store, registry: ShapeUtilRegistry): DocumentPageRef[];
```

Define the `planAddPageFrameGeometry` input fields in the plan file you
write, as `{ flow, frames (flow order, with boxes and page specs), anchorId | null, contentBounds | null, size?, orientation? }`.

## Rules

- Presets, as portrait width x height at 96 dpi:

  | Preset | Size | Default orientation |
  | --- | --- | --- |
  | a4 | 794x1123 | portrait |
  | a5 | 559x794 | portrait |
  | letter | 816x1056 | portrait |
  | legal | 816x1344 | portrait |
  | slide-16-9 | 1080x1920 | landscape |
  | slide-4-3 | 768x1024 | landscape |

  Landscape swaps the sides. `custom` returns `current`, or the A4 size when
  `current` is absent.
- `pageFramePresetOf` returns the stored size only when the box equals
  `pageFrameSize(page)` within 0.5. Otherwise it returns `custom`.
- Top-level means no entry in `frameParents(store, pageId, createShapeContext(store, registry, 1))`
  (`packages/core/src/frame-tree.ts:26`).
- Flow order uses `visual.x` and `visual.y`. Vertical sorts by `(y, x, id)`.
  Horizontal sorts by `(x, y, id)`.
- Add geometry (design 5.3):
  - Anchor `A`, vertical: `(A.x, A.y + A.height + GAP)`.
  - Anchor `A`, horizontal: `(A.x + A.width + GAP, A.y)`.
  - Every frame after `A` in flow order shifts along the flow axis by
    `new extent + GAP`.
  - No anchor and no content: `(0, 0)`.
  - No anchor with content: `(bounds.x, bounds.y + bounds.height + GAP)`
    for vertical, `(bounds.x + bounds.width + GAP, bounds.y)` for
    horizontal.
  - Size and orientation come from the options, else the anchor, else A4
    portrait (vertical) or slide-16-9 landscape (horizontal).
- Reflow: the input is in the OLD flow order. The first frame keeps its
  position. Each next frame goes at `previous end + GAP` on the new flow
  axis and is aligned to the first frame on the cross axis. Output deltas
  are zero-filtered.
- `planShiftPageFrames`:
  - For each frame, take `expandContainers(store, [id], context)`
    (descendants included), de-duplicated across frames.
  - Then `planElementMoves(store, moves)` from
    `packages/core/src/editor/transform.ts:38`, with absolute targets
    `x + dx`, `y + dy`.
- `referencePageFrame` (design 5.3, revised):
  1. The first frame in flow order whose box contains `center` (inclusive
     edges).
  2. Else `selected`, if it is one of `frames`.
  3. Else the frame whose box centre is nearest `center`. Ties go to flow
     order.
  4. Empty `frames` gives `null`.
- `neighbourPageFrame` returns `null` at either end.
- `documentPageSequence`:
  - Iterate `store.listPages()` in tab order, including hidden pages.
  - Pages with page frames give one ref per frame in flow order, with
    `rect` = the frame bounds (`viewBounds`).
  - Otherwise, a page with content gives one ref with
    `rect = pageBounds` expanded by 16 on each side.
  - An empty page gives no ref.

## Pitfalls

- Never mutate the store. Plans return commands or values.
- A frame with `page` that has a frame parent is ignored everywhere.
- `noUncheckedIndexedAccess`.
- Use `createShapeContext` from `../hit-test.ts`, imitating
  `packages/core/src/text-layout.ts:3`.

## Tests (input -> expected)

- `pageFrameSize("a4","landscape")` is 1123x794.
  `pageFrameSize("slide-16-9","landscape")` is 1920x1080.
  `custom` with `current` 500x400 returns 500x400.
- `pageFramePresetOf` gives a4 for a 794x1123 box, and custom for a
  795x1123 box with page a4.
- Order: three frames at y 1200, 0 and 2400 sort to y 0, 1200, 2400. The
  same frames in horizontal flow sort by x. A frame nested in another frame
  is excluded.
- Add:
  - Anchor at index 0 of frames at y 0 and 1171, vertical: the new frame is
    at y 1171, and the old second frame shifts by 1171 (1123 + 48).
  - Horizontal is the mirror case.
  - Empty page: (0, 0). Content at (10,10,100,100), vertical: (10, 158).
- Reflow vertical to horizontal for frames at (0,0) and (0,1171) moves the
  second frame by dx +842, dy -1171.
- `planShiftPageFrames` moves a child `text.note` inside the frame by the
  same delta. A child shared by two frames moves once.
- `referencePageFrame`:
  - A centre inside B with A selected gives B.
  - A centre outside every frame with B selected gives B.
  - A centre outside every frame with no selection gives the nearest frame.
- `neighbourPageFrame`: C next gives null, A previous gives null, B next
  gives C.
- Sequence:
  - Two pages in tab order, the first with frames at y 0 and 1171, the
    second with only shapes, give 3 refs in that order. The last rect is
    the content bounds plus 16.
  - An empty page gives none.
  - A hidden-in-presentation page is still included.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-04-page-geometry/)

1. `bun test packages/core/src/page-frames`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/core/src/page-frames`

## Done criteria

- The contract names are exported from `@nodetto/core`.
- All three commands exit 0.
- The progress log records the commands, exit codes, log paths and the
  index.ts hashes.

## Coordination

Same rules as dps-01 for the shared `packages/core/src/index.ts` line. No
git state changes.
