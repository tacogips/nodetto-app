# kicad-pcb-05-core-editing

- planId: kicad-pcb-05-core-editing
- planPath: impl-plans/completed/kicad-pcb-05-core-editing.md
- wave: 2; dependsOn: kicad-pcb-01-ir-core-contracts
- design: design-docs/specs/design-kicad-pcb.md sections 5.1, 5.2, 5.3,
  5.4
- progress log: impl-plans/progress/kicad-pcb-05-core-editing.md
- scratch: tmp/kicad-pcb-s534/kicad-pcb-05-core-editing/
- protocol: impl-plans/completed/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Make PCB elements movable and editable through the core `Editor`:
generic moves translate the semantic geometry; footprints rotate; track
ends inside a moved or rotated footprint's pads follow it (for every move
source, including undo/redo, inspector and CLI `edit`); tracks and vias
can be added. Everything goes through `Editor.apply`, so it is undoable.

## Repository context (imitate)

- `packages/core/src/editor.ts`:
  - `moveElements` (line ~1616): the `edge.generic` semantic branch and
    the early no-op check
  - `movableSelection` (line ~2061)
  - `apply`: the planner block guarded by breadboard presence (line
    ~1162, `planBreadboardTranslations`)
- `packages/core/src/breadboard/board-carry.ts:planBreadboardTranslations`:
  a planner that compares `before` and `draft` stores and returns
  `Command[]`.
- `packages/core/src/commands.ts`: the `Command` shapes `updateSemantic`
  and `addElement`. Check the real names in the file before using them.
- `packages/core/src/fractional.ts:keyBetween`: index placement.
- `packages/core/src/breadboard/editor-breadboard.test.ts`: how editor
  tests are written (document, `new Editor`, apply, undo).
- Plan 01 helpers (relative import `./geometry.ts`): `pcbAnchor`,
  `translatePcbSemantic`, `footprintToBoard`, `boardToFootprint`,
  `padCopperOutline`, `outlineContains`, `outlineBounds`,
  `padHasCopperLayer`, `pageCopperLayers`, `PcbGrid`, `footprintBounds`;
  `test-builder.ts:buildPcbDocument`; `roundNm`, `PCB_PAGE_SCALE` from
  `@nodetto/ir`.

## Non-goals

- No connectivity, ratsnest or highlight (plan 06), no shape utils
  (plan 08), no UI.
- Do not add pcb types to `ROTATABLE_LEAF_TYPES` in
  `packages/core/src/rotation.ts`: generic rotation must stay off.
- Vias, zones and graphics never follow footprints.
- No footprint flip.

## writePaths

- packages/core/src/editor.ts
- packages/core/src/pcb-board/follow.ts (new)
- packages/core/src/pcb-board/follow.test.ts (new)
- packages/core/src/pcb-board/edit.ts (new)
- packages/core/src/pcb-board/edit.test.ts (new)
- impl-plans/progress/kicad-pcb-05-core-editing.md (new)

## sharedPaths

none (`editor.ts` is owned only by this plan in this run)

## Pinned interfaces

- `edit.ts`:
  - `pcbMoveCommand(element: Element, targetPageX: number, targetPageY:
    number): Command | undefined`: `dx = (target - anchor*PCB_PAGE_SCALE)
    / PCB_PAGE_SCALE`, then `updateSemantic` with
    `translatePcbSemantic`. Returns `undefined` when `dx` and `dy` are
    both 0 or there is no anchor.
  - `rotatePcbFootprintSemantic(semantic, degrees)`: rotation
    normalised to `[0, 360)`.
  - `PcbTrackInput = {layer, width, net, points: PcbXY[]}`
  - `PcbViaInput = {at, diameter, drill, net, layers?: [string, string]}`
  - `pcbInsertIndex(store, pageId, type: "pcb.track" | "pcb.via"):
    FractionalIndex`: a key just above the last element of that type on
    the page. Otherwise, for a track, above the last zone, graphic or
    board; for a via, above the last track. Always below the first
    footprint, via `keyBetween(prev, next)`.
  - `PCB_TRACK_DEFAULT_WIDTH = 0.25`, `PCB_VIA_DEFAULT = {diameter: 0.6,
    drill: 0.3}`
- `follow.ts`: `planPcbTrackFollow(before: Store, draft: Store): Command[]`
- `Editor` additions:
  - `rotatePcbFootprints(ids: readonly ElementId[], degrees: number,
    options?: ApplyOptions): void` (skips locked and non-footprint ids)
  - `addPcbTrack(pageId: PageId, input: PcbTrackInput): ElementId`
  - `addPcbVia(pageId: PageId, input: PcbViaInput): ElementId`
  - Both add methods round points to nm, use `pcbInsertIndex`, and create
    `visual: {}`.

## File-level changes in `editor.ts`

1. `movableSelection`: for `isPcbElementType(leaf.type)` with an anchor,
   push `{id, x: anchor[0]*PCB_PAGE_SCALE, y: anchor[1]*PCB_PAGE_SCALE}`.
   `pcb.board` is never pushed. Locked elements follow the existing rule
   (check how locked is handled and keep it).
2. `moveElements`:
   - The early no-op check compares pcb elements against their anchor in
     page units, not `visual.x`.
   - In the loop, pcb elements push only `pcbMoveCommand(...)`; never an
     `updateVisual` with x and y.
3. `apply`: after the breadboard planner block, add a block guarded by
   `this.store.listPages().some(p => p.kind === "pcb") ||
   draft.listPages().some(...)`, or by any `pcb.` element in either store
   (same shape as the breadboard guard). It does
   `derived.push(...planPcbTrackFollow(this.store, draft))`.
4. The new Editor methods above.

## Follow algorithm (`follow.ts`, design 5.3)

1. For each `pcb.footprint` in `before` whose draft has a different `at`
   or `rotation`, collect `(oldFp, newFp)`.
2. If there are none, return `[]` immediately. This is a cheap path: one
   pass over footprints.
3. Build a `PcbGrid` of the page's `pcb.track` elements that are equal in
   both stores (`before.get(id) === draft.get(id)` by value, or compare
   their semantics). Tracks already changed in the batch are skipped.
4. For each changed footprint, query the grid with its old
   `footprintBounds`. For each candidate track end (first and last
   point), find the first pad, in pad order, that has the track's layer
   (`padHasCopperLayer` with `pageCopperLayers`) and whose old
   `padCopperOutline` contains the end. The new end is
   `footprintToBoard(newFp, boardToFootprint(oldFp, end))`, rounded to
   nm.
5. Arc tracks (`mid`):
   - both ends moved by the same footprint: `mid` gets the same mapping
   - one end moved: `mid` is the new chord midpoint plus the old sagitta
     vector (old mid minus old chord midpoint), rotated to the new chord
     direction and scaled by `newChordLength / oldChordLength`. Use
     arithmetic and `Math.sqrt` only. If the old chord length is 0, leave
     `mid` unchanged.
6. Emit one `updateSemantic` per changed track, with all its moved ends
   merged.

## Pitfalls

- Absolute drag targets: the interaction calls `moveElements` with
  `origin + totalDelta` on every pointer move. A delta computed against
  `visual.x` (absent) would add up. Compute it against the current
  anchor, and test this.
- Do not write `visual.x`, `visual.y` or `visual.rotation` on pcb
  elements anywhere.
- A footprint moved together with its selected tracks: the tracks are
  already translated in the batch, so the follow must skip them (step 3).
- Undo: one `apply` produces the footprint change and the follow
  commands, so a single undo restores both. Test it.
- Do not run the follow planner in a way that re-triggers on its own
  output: it only reacts to footprint changes.
- Performance: no loop over all tracks for each footprint; use the grid.

## Tests (input -> expected)

`edit.test.ts`:

- `moveElements` on a footprint with targets `(origin+5, origin)`, then
  `(origin+10, origin)` (absolute) -> `at` moved by exactly 1.0 mm, not
  1.5.
- Moving a via, a track, a zone (fills move too) and a graphic gives the
  expected semantic changes. `visual` is still `{}`.
- `movableSelection` includes pcb elements with anchor times 10 and
  excludes `pcb.board`.
- `rotatePcbFootprints([fp], 90)` twice from 300 -> 120. Locked
  footprints are unchanged.
- `addPcbTrack` -> a valid element whose index is between the last track
  and the first via. `addPcbVia` -> index above the tracks and below the
  footprints. Points are rounded to nm.
- `canRotateElement` is false for a footprint (regression guard).

`follow.test.ts` (documents from `buildPcbDocument`):

- A track ending at pad 1's centre; moving the footprint by (2, 0) -> the
  track end moves by (2, 0) and the other end stays.
- An end inside the pad but 0.2 off-centre -> the offset is kept after a
  90 degree rotation (expected values computed with `pcbRotate`).
- An end outside every pad -> not moved.
- A track on B.Cu with an SMD pad only on F.Cu -> not moved.
- A two-ended track on one footprint -> both ends and an interior point:
  only the ends move.
- Footprint and track moved in one batch -> the track moves only by the
  batch translation.
- An arc track with one end attached -> `mid` follows the sagitta rule
  (expected value computed in the test).
- Undo after a footprint move restores the footprint and the track.
- An inspector-style `updateSemantic` of footprint `at` (no
  `moveElements`) also triggers the follow.

## Verification

1. `bun test packages/core/src/pcb-board/edit.test.ts packages/core/src/pcb-board/follow.test.ts` exits 0.
2. `bun test packages/core/src/editor.test.ts packages/core/src/breadboard packages/core/src/editor-ux.test.ts` exits 0 (no regression).
3. `bun run typecheck` exits 0.
4. `bunx biome check packages/core/src/editor.ts packages/core/src/pcb-board/follow.ts packages/core/src/pcb-board/follow.test.ts packages/core/src/pcb-board/edit.ts packages/core/src/pcb-board/edit.test.ts --diagnostic-level=warn`
   exits 0.

## Done criteria

- `grep -c "planPcbTrackFollow" packages/core/src/editor.ts` is at least 1.
- `grep -n "rotatePcbFootprints\|addPcbTrack\|addPcbVia" packages/core/src/editor.ts`
  shows all three methods.
- All verification steps are recorded with exit code 0.
