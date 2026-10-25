# breadboard-06-core-editing

- planId: breadboard-06-core-editing
- planPath: impl-plans/active/breadboard-06-core-editing.md
- wave: 3; dependsOn: breadboard-02-core-foundation
- design: design-docs/specs/design-breadboard.md sections 4.2, 4.3, 4.4,
  7.4, 5.2 (probe target state), 3.3; user-QA Q2
- progress log: impl-plans/progress/breadboard-06-core-editing.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/core/src/breadboard/(snap|rotate|annotate|board-carry|editor-breadboard\.test|snap\.test|annotate\.test)|^packages/core/src/shapes/breadboard|^packages/core/src/editor\.ts|^packages/core/src/shapes/index\.ts`

## Intent

Make breadboard elements editable through Editor intents:
- lattice snapping
- 90-degree rotation about pin 1
- parameter edits that keep pin 1 in place
- board moves that carry their contents
- automatic annotation on create, paste and duplicate, plus "Fix
  references"
- transient probe-target state for cross-probing
- shape utils for bounds, hit testing and pin hit testing

## Non-goals

- No connectivity, ERC or rendering.
- No ui-solid gestures. Plan 12 calls these intents.
- No board rotation. `canRotateElement` stays false for breadboard types.

## writePaths

- packages/core/src/breadboard/snap.ts (new)
- packages/core/src/breadboard/rotate.ts (new)
- packages/core/src/breadboard/annotate.ts (new)
- packages/core/src/breadboard/board-carry.ts (new)
- packages/core/src/breadboard/snap.test.ts (new)
- packages/core/src/breadboard/annotate.test.ts (new)
- packages/core/src/breadboard/editor-breadboard.test.ts (new)
- packages/core/src/shapes/breadboard.ts (new)
- packages/core/src/shapes/breadboard.test.ts (new)
- packages/core/src/shapes/index.ts
- packages/core/src/editor.ts
- impl-plans/progress/breadboard-06-core-editing.md

## sharedPaths

- packages/core/src/breadboard/index.ts

## sharedPathNotes

- packages/core/src/breadboard/index.ts: append exactly
  `export * from "./snap.ts";`, `export * from "./rotate.ts";` and
  `export * from "./annotate.ts";` (fresh read, pre/post hash, append only).
  Do not export `board-carry.ts`. The Editor imports it directly.

## Contracts (pinned; plans 12, 13, 14, 17 rely on them)

```ts
// snap.ts
export function snapBreadboardPoint(p: Vec): Vec;                       // round to the 10-unit lattice
export function snapBreadboardDelta(store: Store, pageId: PageId, movingIds: readonly ElementId[], delta: Vec): Vec;
export function isBreadboardSnapTarget(store: Store, ids: readonly ElementId[]): boolean; // moving set contains a breadboard element
// rotate.ts
export function planBreadboardRotation(store: Store, ids: readonly ElementId[], quarterTurns: 1 | -1): Command[];
// annotate.ts
export function annotateBreadboardParts(existing: readonly string[], incoming: readonly { type: BreadboardPartType; reference: string }[]): readonly string[];
export function planBreadboardAnnotation(store: Store, pageId: PageId): Command[]; // fix duplicates and unannotated
// shapes/breadboard.ts
export const breadboardShapeUtils: readonly ShapeUtil[];   // one per breadboard.* type
export function breadboardPinAt(store: Store, pageId: PageId, point: Vec): { elementId: ElementId; pin?: number; wireEnd?: 0 | 1 } | null;
// Editor (editor.ts)
createBreadboardPart(type: BreadboardElementType, at: Vec, semantic?: Partial<...>, applyOptions?): ElementId | null; // boards, parts, netlist cards, wires (at = first point)
rotateBreadboardParts(ids: readonly ElementId[], quarterTurns: 1 | -1, applyOptions?): boolean;
updateBreadboardSemantic(id: ElementId, patch: Readonly<Record<string, unknown>>, applyOptions?): boolean;
annotateBreadboard(pageId: PageId, applyOptions?): boolean;
breadboardProbe(): BreadboardProbe | null;
setBreadboardProbe(probe: BreadboardProbe | null): void;
onBreadboardProbeChange(listener: (probe: BreadboardProbe | null) => void): () => void;
```

## File-level changes

### snap.ts (design 4.2)

The anchor is:
- pin 1 for a part (`breadboardPins(element)[0]`)
- hole `a1` for a board
- the top-left corner for a netlist card
- the first point for a wire

`snapBreadboardDelta` takes the first breadboard element of the moving set
in element index order. It returns the delta that puts that element's
anchor (at `origin + delta`) on the nearest lattice point.

### rotate.ts (design 4.2)

For part types only (boards, wires and cards are ignored):
- `rotation = (rotation + 90 * quarterTurns) mod 360`, normalised to
  0, 90, 180 or 270
- translate `visual.x/y` so that pin 1 keeps its page position, then
  re-round that position to the lattice
- each part rotates in place

The result is a set of `updateVisual` commands (use the existing command
type names from `packages/core/src/commands.ts`).

### annotate.ts (design 7.4)

- `annotateBreadboardParts`: an unannotated incoming reference (ending in
  `?`), or one that collides with `existing` or an earlier incoming
  reference, gets the lowest free number for its type prefix
  (`BREADBOARD_REFERENCE_PREFIX`). Other references are kept.
- `planBreadboardAnnotation`: the first holder of each reference, in
  element index order, keeps it. Later duplicates and unannotated parts
  get the lowest free numbers.

### board-carry.ts (design 4.4)

`planBreadboardTranslations(before: Store, draft: Store): Command[]`,
imitating `planBpmnTranslations` (editor.ts:1101 call site; source in
`packages/core/src/bpmn/`). When a board's `visual.x/y` changed in the
draft, translate by the same delta:
- every part whose pins all lie on that board's holes (before the move)
- every wire whose two ends both lie on that board's holes (before the
  move)

Skip elements the batch already moved, and elements whose pins span
several boards.

### shapes/breadboard.ts and shapes/index.ts (design 4.3)

One `ShapeUtil` per type. Each has:
- `canResize: false`
- `getBounds` from `breadboardBox`; a wire's bounds are its points grown
  by half its stroke width (0.45 pitch / 2)
- `hitTest`: the box for parts, boards and cards; within 4 page units of a
  segment for wires
- `defaultSemantic` from `breadboardDefaultSemantic`, and a sensible
  `defaultVisual`

`breadboardPinAt` finds a pin or wire end within 4 page units (0.4
pitch), choosing the topmost element. Register the utils in
`createDefaultRegistry` (shapes/index.ts:38) next to the BPMN utils
(line 128).

### editor.ts

- `createBreadboardPart`:
  - builds the element with the default semantic merged with `semantic`
  - places its anchor at `snapBreadboardPoint(at)`
  - writes the catalogue box into `visual.width/height` (not for wires)
  - annotates part types against the current page's references
  - a new board is given the lowest fractional index on the page (bottom
    of the z-order)
  - one `apply` call
- `rotateBreadboardParts`: one apply, one undo step.
- `updateBreadboardSemantic`: validates that the element is a breadboard
  type and merges the patch. When `span` or `pinCount` change, it rewrites
  `visual.x/y/width/height` so that pin 1 keeps its page position. One
  apply.
- `annotateBreadboard(pageId)`: one apply of `planBreadboardAnnotation`.
  Returns false when there is nothing to change.
- Paste and duplicate: in `insertCopies` (editor.ts:3148), when the target
  page kind is `breadboard`, run `annotateBreadboardParts` over the
  planned breadboard part elements before committing. This is the only
  change to the paste path.
- `Editor.apply` planner: call `planBreadboardTranslations` next to
  `planBpmnTranslations` (editor.ts:1092-1104), guarded by "any
  breadboard page or `breadboard.*` element in the store or draft", as
  the BPMN guard is.
- Probe state:
  - a private field and listener set, imitating `onBpmnRejection`
    (editor.ts:430)
  - `setBreadboardProbe` notifies only when the value changes (compare
    page, element ids and pin)
  - `setCurrentPage` clears the probe when the page actually changes
  - the probe is never written to the document or history

## Pitfalls

- Undo, redo, raw `apply`, imports and collab never annotate. Only the
  three intents do (design 7.4).
- Snapping must not run for non-breadboard selections. `isBreadboardSnapTarget`
  is the guard plan 12 uses.
- Rotation must not use `canRotateElement`, and must not enable the generic
  rotate handle (`packages/core/src/rotation.ts:28` stays unchanged).
- Keep BPMN behaviour byte-identical. Existing editor tests must pass
  unchanged.
- Fractional index for "bottom of z-order": use the existing helpers in
  `packages/core/src/fractional.ts`. Never renumber other elements.

## Tests (input -> expected)

`snap.test.ts`:
- `snapBreadboardPoint({x: 14, y: 26})` -> (10, 30)
- moving a resistor whose pin 1 is at (31, 47) by (0,0) -> a delta that
  puts pin 1 at (30, 50)
- a moving set of a geo shape and a resistor -> snaps by the resistor's
  anchor
- a moving set with only a geo shape -> `isBreadboardSnapTarget` false

`annotate.test.ts`:
- existing `[R1, R2]` with incoming `R?` -> `R3`
- incoming `[R1, R1]` with existing `[]` -> `[R1, R2]`
- existing `[R1, R3]` with incoming `R?` -> `R2` (lowest free)
- an LED and a diode share prefix `D` -> numbered together
- `planBreadboardAnnotation` on R1, R1, `R?` (in element order) -> the
  first keeps R1, then R2, then R3

`editor-breadboard.test.ts`:
- `createBreadboardPart("breadboard.resistor", {x: 33, y: 47})` -> pin 1
  at (30, 50) and reference `R1`; a second create -> `R2`
- a new board gets an index below the existing parts
- rotate a resistor 4 times by +1 -> back to rotation 0, with pin 1 at the
  same page position every time, and all pins on the lattice at 90, 180
  and 270
- rotate by -1 from 0 -> 270
- `undo` after a rotate restores the visual exactly
- `updateBreadboardSemantic(r, {span: 6})` -> pin 1 unchanged, pin 2 moves
  to pin 1 + 60
- an IC `pinCount` change from 8 to 14 -> pin 1 unchanged
- moving a board carries a resistor fully on its holes and a wire with
  both ends on its holes; a part with one pin off the board is not
  carried
- copy and paste a resistor R1 onto the same breadboard page -> the copy
  is R2; pasting onto a freeform page -> R1 is kept
- `annotateBreadboard` fixes duplicates in one undo step
- probe: `setBreadboardProbe(p)` notifies once; setting the same value
  again does not notify; `setCurrentPage(other)` clears it to null

`shapes/breadboard.test.ts`:
- the registry returns a breadboard util for all 13 types, each with
  `canResize` false
- wire hitTest 3 units from a segment -> true; 6 units away -> false
- `breadboardPinAt` 3 units from LED pin 2 -> `{elementId, pin: 2}`

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-06-core-editing
bun test packages/core/src/breadboard/snap.test.ts packages/core/src/breadboard/annotate.test.ts packages/core/src/breadboard/editor-breadboard.test.ts packages/core/src/shapes/breadboard.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/core > tmp/breadboard-mode-s485/breadboard-06-core-editing/core.log 2>&1   # G2 (editor.test.ts, bpmn tests unchanged and green)
bun run typecheck > tmp/breadboard-mode-s485/breadboard-06-core-editing/typecheck.log 2>&1   # G1
bunx biome check packages/core/src/breadboard/snap.ts packages/core/src/breadboard/rotate.ts packages/core/src/breadboard/annotate.ts packages/core/src/breadboard/board-carry.ts packages/core/src/breadboard/snap.test.ts packages/core/src/breadboard/annotate.test.ts packages/core/src/breadboard/editor-breadboard.test.ts packages/core/src/shapes/breadboard.ts packages/core/src/shapes/breadboard.test.ts packages/core/src/shapes/index.ts packages/core/src/editor.ts   # exit 0
git diff --quiet -- packages/core/src/rotation.ts packages/core/src/snap.ts   # exit 0
```

## Done criteria

- The breadboard barrel has the three appended lines exactly once.
- All verification lines pass, with exit codes and counts in the progress log.
