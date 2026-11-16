# dps-11-page-editing

- planId: dps-11-page-editing. Wave 2.
- dependsOn: dps-03-model, dps-04-page-geometry.
- Design: sections 5.3 and 5.4 of
  `design-docs/specs/design-document-pages-snippets.md`, plus user-qa Q5
  and Q8.
- writePaths:
  - New files:
    - `packages/core/src/page-frames/editing.ts`
    - `packages/core/src/page-frames/editing.test.ts`
    - `packages/ui-solid/src/inspector/PageFrameSection.tsx`
    - `packages/ui-solid/src/inspector/PageFlowControl.tsx`
    - `packages/ui-solid/src/inspector/page-frame-edits.ts`
    - `packages/ui-solid/src/inspector/page-frame-edits.test.ts`
  - Existing file: `packages/core/src/editor/facade/page-editing.ts`.
  - Logs and artifacts: `impl-plans/progress/dps-11-page-editing.md`,
    `tmp/dps-s861/dps-11-page-editing`, `target`.
- sharedPaths: `packages/core/src/page-frames/index.ts`, created by dps-04.
  Append exactly `export * from "./editing.ts";`.
- artifactRoots: `target`.

## Intent and context

This plan implements "Add page", the flow change with re-layout as one undo
step, and stateless next and previous page-frame navigation on the editor
facade. It also builds the inspector section and the page-flow control.

dps-17 registers the actions and shortcuts (PageDown and PageUp), the
palette tile and the inspector mounts.

## Non-goals

- No new Command kind.
- No edits to `shortcuts.ts`, `Toolbar.tsx`, `Inspector.tsx` or
  `shape-palette.ts`.
- No navigation state stored anywhere.

## Contract

```ts
// page-frames/editing.ts (pure planners over Editor-free inputs where possible)
export function planAddPageFrame(store, registry, pageId, input: { id: ElementId; anchorId: ElementId | null; size?: string; orientation?: "portrait"|"landscape" }): { commands: Command[]; id: ElementId } | null;
export function planSetPageFlow(store, registry, pageId, flow: "vertical"|"horizontal"): Command[]; // [] when unchanged
// facade methods added to the class in editor/facade/page-editing.ts
addPageFrame(options?: { after?: ElementId; size?: string; orientation?: "portrait"|"landscape" }): ElementId | null;
setPageFlow(pageId: PageId, flow: "vertical" | "horizontal"): boolean;
goToPageFrame(direction: "next" | "previous", size: ViewportSize): boolean;
pageFrameAnchor(): ElementId | null; // selected page frame, or top-level page frame containing the single selected element
```

## Rules

- `planAddPageFrame`:
  - Use `planAddPageFrameGeometry` (dps-04) with the current page's
    `pageFlowOf`, `pageFramesInFlowOrder` and `pageBounds`.
  - Build one `createElement` for a `frame`, imitating element
    construction in `packages/core/src/editor/pages.ts:planPageElementsCopy`
    and the frame tool defaults:
    - semantic `{ name: "Page N", page: { size, orientation }, showTitle: false, clipContent: true }`,
      where N is the smallest positive integer not used by a frame name
      `Page N` on the page;
    - visual `{ x, y, width, height, style: { fill: "#ffffff" } }`;
    - a fractional `index` placing it after the current last element, in
      the same way the paste and copy paths compute `index`.
  - Then append `planShiftPageFrames` for the shifted frames.
- `planSetPageFlow`:
  - Return `[]` when `pageFlowOf(page) === flow`.
  - Otherwise return
    `[{ type: "updatePage", id, page: { pageFlow: flow === "vertical" ? null : "horizontal" } }, ...shiftCommands]`.
    The shift commands come from `planReflowPageFrames(oldOrder, flow)` and
    `planShiftPageFrames`.
- Facade:
  - `addPageFrame` and `setPageFlow` wrap their commands in
    `beginBatch`/`endBatch` around `apply`, so each is one undo entry.
    Imitate the existing facade batching in
    `packages/core/src/editor/facade/core.ts:366-372`.
  - `addPageFrame`:
    - uses `this.idSource()` for the id;
    - selects the new frame with the facade's existing selection setter
      (imitate how `paste`, `selection-editing.ts:92`, selects inserted
      elements);
    - returns null when the document is read-only. Check the existing
      read-only guard used by other mutating facade methods.
  - `goToPageFrame`:
    - The centre is `camera.screenToPage({ x: size.width / 2, y: size.height / 2 })`.
    - `referencePageFrame` gets frames in flow order, their `viewBounds`
      boxes, and the current single selection when it is a page frame (or
      `pageFrameAnchor()`).
    - Find the neighbour with `neighbourPageFrame`.
    - When found, `this.camera.fitBox(box, size, { maxZoom: 4 })`, as
      `zoomToSelection` does at `page-editing.ts:299-310`, and return true.
    - Otherwise return false and leave the camera untouched.
    - Never call `apply` and never change the selection.
- UI pure module `page-frame-edits.ts`:
  - `pageFrameToggleCommands(element, flow)`:
    - adding `page` to a top-level frame gives A4 portrait for vertical
      flow or slide-16-9 landscape for horizontal flow, and resizes the
      box;
    - removing it deletes the `page` key.
  - `pageFrameSizeCommands(element, size, orientation)` gives
    `updateSemantic` plus `updateVisual` (width and height from
    `pageFrameSize`).
  - `pageFramePresetLabel(element)` gives the preset label, or "Custom".
- `PageFrameSection.tsx`:
  - It is shown for a frame.
  - It has a "Page" switch (disabled for frames with a frame parent), a
    size select (presets plus Custom; Custom keeps the box), an orientation
    toggle, and an "Add page" button calling `editor.addPageFrame()`.
  - Each change is one `apply`, batched when there are two commands.
- `PageFlowControl.tsx` has Vertical and Horizontal buttons calling
  `editor.setPageFlow(currentPageId, flow)`.
- Imitate `packages/ui-solid/src/inspector/PresentationSection.tsx` for
  layout and the existing inspector components.

## Pitfalls

- Moves must carry frame descendants. Use `planShiftPageFrames`, never a
  bare `updateVisual` on the frame.
- One undo step: assert the history length in tests, and that undo
  restores the positions and the `pageFlow` key absence.
- `goToPageFrame` with a stale selection must resolve from the viewed
  frame (design 5.3).

## Tests (core `editing.test.ts` with a real `Editor`, using a deterministic `idSource`; ui pure tests)

- Add after the selected A (frames A at y 0 and B at y 1171, vertical):
  - the new frame is at y 1171 and B moves to y 2342;
  - a `text.note` child of B moves with it;
  - one undo restores everything and removes the new frame;
  - the new frame is selected and named "Page 3".
- Add with no frames on an empty page gives (0, 0), A4 794x1123. On a
  horizontal page it gives 1920x1080.
- `setPageFlow` horizontal:
  - the frames are laid out left to right with a 48 gap and the page has
    `pageFlow` `"horizontal"`;
  - undo restores both;
  - `setPageFlow` vertical on a vertical page returns false and applies
    nothing.
- Navigation, in both flows, with frames A, B and C, A selected and the
  camera fitted to A:
  - next gives B, next gives C, previous gives B;
  - at C, next returns false and the camera is unchanged;
  - with the camera centre outside every frame and B selected, next gives
    C;
  - after a manual `fitBox` onto C, previous gives B;
  - the history length and selection are unchanged throughout.
- `page-frame-edits`:
  - the toggle on adds a4 portrait at 794x1123;
  - size letter landscape gives 1056x816;
  - the label for a modified box is "Custom".

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-11-page-editing/)

1. `bun test packages/core/src/page-frames packages/ui-solid/src/inspector/page-frame-edits.test.ts`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/core/src/page-frames/editing.ts packages/core/src/page-frames/editing.test.ts packages/core/src/editor/facade/page-editing.ts packages/ui-solid/src/inspector/PageFrameSection.tsx packages/ui-solid/src/inspector/PageFlowControl.tsx packages/ui-solid/src/inspector/page-frame-edits.ts packages/ui-solid/src/inspector/page-frame-edits.test.ts`

## Done criteria

- The facade methods exist.
- All three commands exit 0.
- The progress log records the commands, exit codes, log paths and the
  hashes of shared files.

## Coordination

Re-read `page-editing.ts` and `page-frames/index.ts` before each edit and
record hashes. No git state changes.
