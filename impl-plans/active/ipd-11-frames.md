# ipd-11-frames

- planId: ipd-11-frames
- planPath: impl-plans/active/ipd-11-frames.md
- progressPath: impl-plans/progress/ipd-11-frames.md
- dependsOn: ipd-01-ir-schema, ipd-04-cli-edit-contracts, ipd-05-core-catalogue, ipd-06-geo-strokes, ipd-07-icon-core-cli (both edit `packages/core/src/svg-export/shapes.ts`)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 6 (6.1-6.4 and 6.6), D7 and D10.
- Evidence: `tmp/ipd-s772/ipd-11-frames/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/insertion-parent.ts`
  - `packages/core/src/insertion-parent.test.ts`
  - `packages/core/src/frame-title.test.ts`
  - `packages/core/src/svg-export/shapes.ts`
  - `packages/core/src/svg-export/document.ts`
  - `packages/ui-solid/src/shapes/FrameView.tsx`
  - `packages/ui-solid/src/interaction/creation.ts`
  - `packages/ui-solid/src/interaction/transform.ts`
  - `packages/ui-solid/src/frame-parent-interaction.test.ts`
  - `apps/cli/src/edit/parent-fields.ts`
  - `apps/cli/src/inspect-command.ts`
  - `apps/cli/src/frame-parent.test.ts`
  - `impl-plans/progress/ipd-11-frames.md`
  - `tmp/ipd-s772/ipd-11-frames`
  - `packages/ui-solid/src/interaction-creation.test.ts`
- sharedPaths:
  - `packages/core/src/index.ts`
  - `apps/cli/src/commands.test.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
  - path: `apps/cli/src/commands.test.ts`; intendedEdit: update inspect expectations only where frame children now show rel coordinates
- artifactRoots:
  - `tmp/ipd-s772/ipd-11-frames`
<!-- ownership:end -->

## Intent and context

D7: membership is `memberIds` when present, geometric otherwise (`packages/core/src/frame-tree.ts:26-117`). CLI `add` writes no membership, so an element added inside an auto-layout frame (which always has `memberIds`) does not join it.

D10: the frame title is drawn inside the artboard (`svg-export/shapes.ts:240-253`, `FrameView.tsx:125-138`), where content covers it.

This plan delivers:

- the shared core insertion-parent function;
- the CLI `parent`/`memberIndex` hooks;
- desktop create/drop attachment;
- outside titles for device and screen frames;
- `strokeAlign`/`strokeSides` on frames, via `ipd-06`'s helper;
- parent-relative coordinates in `inspect`.

## Non-goals

- No `parentId` field.
- No change to geometric membership rules for frames without `memberIds`.
- No change to diagram frames (no platform, no screen kind): their inside title and `FRAME_TITLE_BAND` stay.
- Prototype export changes in `svg-export/document.ts` belong to `ipd-13`. This plan only adds title bounds.

## File-level changes

New `packages/core/src/insertion-parent.ts`:

- `export function findInsertionParent(store: Store, pageId: PageId, box: Box, context: ShapeContext, exclude?: ReadonlySet<ElementId>): ElementId | undefined`
  - Returns the smallest-area frame on the page whose box fully contains `box`.
  - Ties are broken by higher z-order.
  - Excludes the element itself and its descendants.
- `export function planAttachToFrame(store: Store, frameId: ElementId, elementId: ElementId, memberIndex?: number): Command[]`
  - Empty when the frame has no `memberIds`, because geometric membership already applies, or when the element is already a member.
  - Otherwise returns one `updateSemantic` inserting the id at `memberIndex`, clamped, or at the end.
  - Imitate `packages/core/src/frame-membership.ts:planReorderMember` for the command shape.
- Explicit reparent to a different frame reuses `planReparent` (`frame-membership.ts:9`) through `editor.reparentElement`.

`apps/cli/src/edit/parent-fields.ts` replaces the `ipd-04` stubs, keeping their signatures.

- `resolveParentPlacement`:
  - `parent` resolves through the batch reference rules (id prefix, `@ref`, `name:`). It must be a `frame` on the target page.
  - `memberIndex` must be an integer >= 0.
  - Returns `{parentId, origin: {x: frame.x, y: frame.y}, memberIndex}`.
  - `memberIndex` without `parent` is an error.
- `attachToParent(batch, id, placement, positioned, index)`:
  - **With a placement:**
    - If not positioned and the frame has no layout, move the element to the frame's safe-area top-left (`safeAreaContentBox` from `shapes/frame.ts`), or to the frame's top-left when there is no safe area.
    - Then apply `planAttachToFrame`.
    - If the frame has no `memberIds`, the element is already a geometric child; check with `frameParents`. If the element is not fully inside the frame, record the warning `<id> extends outside its parent frame` and continue.
  - **Without a placement:** `findInsertionParent` on the new box. If found and it has `memberIds`, `planAttachToFrame`.
- `reparentFromUpdate`:
  - With `parent`: `editor.reparentElement(element.id, parentId)`, then reorder to `memberIndex` if given. Return the placement with the new parent origin so `update`'s `visual.x`/`y` are relative.
  - `parent: null` moves the element onto the page; the origin is then the page origin `{0,0}`.

`packages/core/src/svg-export/shapes.ts`, frame case:

- Title:
  - `resolveTitlePlacement(semantic) === "outside"` and `showTitle !== false`: draw the title text at `x`, baseline `y - FRAME_OUTSIDE_TITLE_GAP`, font size 12, using the existing title color and font. Never draw it inside.
  - Inside placement keeps the current code.
- Strokes: when `rectStrokeParts(box, style)` returns parts, paint the frame fill and stroke through `rectStrokeMarkup` with clip id `nd-strokes-<id>`. Otherwise keep the current painting.

`packages/core/src/svg-export/document.ts`:

- Page export bounds include `frameTitleBox` for outside titles, so the title is not cropped.
- Artboard export (`renderArtboardSvg`, `:583-611`) keeps suppressing the title, and must not grow its bounds.
- Selection export of a single frame behaves like artboard export.

`packages/ui-solid/src/shapes/FrameView.tsx`:

- Outside title: a span absolutely positioned above the frame box at the same geometry. Pointer-down on it selects the frame, like the current title.
- Inside placement keeps the current markup.
- Strokes: use `RectStrokes` from `packages/ui-solid/src/shapes/RectStrokes.tsx` when parts exist.

Desktop auto-parent:

- `packages/ui-solid/src/interaction/creation.ts`: after `editor.apply([{type: "createElement", element}])` (`:139`), compute `findInsertionParent` for the new box. If the frame has `memberIds`, apply `planAttachToFrame` in the same history step. Use the same `apply` call with both commands, or the existing batching API; check `editor.apply` options.
- `packages/ui-solid/src/interaction/transform.ts`: on drag end, for each moved top-level element:
  - if the smallest containing frame under its new box has `memberIds` and does not list it, call `editor.reparentElement`;
  - if it was an explicit member of a frame it no longer overlaps, the existing behavior applies. Verify it, and do not change it.

  First write a test that shows the current drop behavior, then fill only the gap. Record the before/after in the progress log.

`apps/cli/src/inspect-command.ts`: for an element whose parent is a frame, append `rel <x>,<y>` (relative to the frame top-left, formatted like the existing coordinates) to its text line. JSON output adds `"rel": {"x":..,"y":..}`.

`packages/core/src/index.ts` (sharedPaths, append-only): export `findInsertionParent` and `planAttachToFrame`.

## Patterns to imitate

- `packages/core/src/frame-membership.ts` for membership commands.
- `apps/cli/src/edit/carry-members.ts` for CLI helpers.
- The existing title drawing in `svg-export/shapes.ts:240-253`.

## Pitfalls

- An outside title must never affect `getBounds` of the frame. Hit testing, layout and arranging use bounds.
- Do not call `planReparent` for plain attachment. It freezes every frame on the page (`frame-membership.ts:9-59`). Use it only for explicit reparent.
- Coordinates with `parent` are relative only in the operation input. Stored geometry stays page space.
- Inspect output changes. Update `apps/cli/src/commands.test.ts` or inspect tests only if they cover frames with children, and list each changed expectation (sharedPaths).
- The examples' preview images change because of outside titles. That is accepted, and `ipd-26` regenerates them. Do not regenerate examples here.

## Tests

New `packages/core/src/insertion-parent.test.ts`:

- Nested frames: a box inside the inner frame -> the inner frame.
- A box partially outside -> undefined.
- `planAttachToFrame` with `memberIndex` 0 -> the id goes first. On a geometric frame -> empty.

New `apps/cli/src/frame-parent.test.ts`:

- **D7 regression.** Frame with layout (vertical, gap 8) and 2 members. `add` a rect inside its box without `parent` -> it becomes the 3rd member, positioned by layout.
- `add` with `parent` and `visual {x:16, y:60}` -> page position = frame + (16,60).
- `add` with `parent` on an iPhone frame without x/y -> y = frame.y + 47.
- `memberIndex: 0` -> first member.
- `update` with `parent` to another frame -> moved into its `memberIds`.
- `parent: null` -> on the page.
- `memberIndex` without `parent` -> error.
- `inspect` shows `rel 16,60`.

New `packages/core/src/frame-title.test.ts`:

- iPhone frame page export: the title `<text>` y < frame y, and the page viewBox top < frame y - 6.
- Artboard export: no title text.
- Diagram frame (no platform): the title stays inside, unchanged.
- `titlePlacement: "inside"` on an iPhone frame -> inside.
- `strokeSides {bottom: 1}` on a frame -> one strip.

New `packages/ui-solid/src/frame-parent-interaction.test.ts`:

- Creating a rect inside an auto-layout frame through the creation interaction -> the rect becomes a member.
- Dragging a rect into an auto-layout frame -> it becomes a member, in one undo step.

Imitate `packages/ui-solid/src/interaction-creation.test.ts` helpers.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/insertion-parent.test.ts packages/core/src/frame-title.test.ts apps/cli/src/frame-parent.test.ts packages/ui-solid/src/frame-parent-interaction.test.ts packages/core/src/frame-tree.test.ts packages/core/src/frame-membership.test.ts packages/core/src/frame.test.ts packages/core/src/arrange-layered.test.ts packages/core/src/svg-export.test.ts packages/ui-solid/src/interaction-creation.test.ts packages/ui-solid/src/interaction-dragging-camera.test.ts apps/cli/src/edit-frame-carry.test.ts apps/cli/src/commands.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check` on the owned files -> exit 0.
4. Visual evidence: export `final/frames.png` at `--scale 2`, from a page with two iPhone frames and one diagram frame. Check that titles are above device frames and never overlap content.

## Done criteria

Verification passes, and the progress log records the before/after drop behavior.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

## Amendment 2026-11-10 (operator round 5)

`packages/ui-solid/src/interaction-creation.test.ts` is added to this plan's writePaths. Add the missing `PrototypeBack` entry to the gesture classification expectation that fails today (1 of 172; finding `integration-s781-w1-ui-solid-prototype-back-gesture`) and change nothing else in that file. Verification adds `bun test packages/ui-solid/src/interaction-creation.test.ts` -> 0 fail. Keep the ipd-11 work already in the working tree and continue from it.
