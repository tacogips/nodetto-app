# schematic-46-ui-wire-point-edit

- planId: schematic-46-ui-wire-point-edit; wave 12; dependsOn:
  schematic-41-ui-keys-drag (chains: circuit.ts 39 -> 41 -> 46;
  interaction.ts and types.ts 39 -> 46)
- design: sections 3.3 (key-preserving writes, range check) and 7.3 "Wire
  point editing" rules 1-6, section 13 item 20 (revision 12)
- progress log: impl-plans/progress/schematic-46-ui-wire-point-edit.md
- revision: 4 (SCH-DESIGN-WIRE-STORED-RANGE, comm-000006; -REJECTED-
  DEGENERATE-DROP, -ENDPOINT-KEY, comm-000004; comm-000050)

## Intent

Edit a placed schematic wire's points by drag and through a keyboard API.
Untouched endpoints stay fixed and local elbows are inserted. An end is
classified once, written at its key, and range-checked before any write. A
rejected sample aborts the whole gesture. Non-goals: no rendering or
Canvas.tsx (45), no new gesture kind, breadboard behaviour byte-identical,
and `keyboard.ts` unchanged.

## writePaths

- packages/ui-solid/src/interaction/schematic-wire-edit.ts (new) and
  packages/ui-solid/src/schematic-wire-edit.test.ts (new)
- packages/ui-solid/src/interaction/circuit.ts, interaction/lifecycle.ts
  (release branch), src/interaction.ts and interaction/types.ts (one field
  each)
- impl-plans/progress/schematic-46-ui-wire-point-edit.md, target, tmp/cad3d
  (artifactRoots: target, tmp/cad3d; sharedPaths: none)

## Repository context

- `circuit.ts` `startBreadboardWirePoint` (~371) and `moveWirePoint` (~233).
  `lifecycle.ts` `endGesture` (~73-85) calls `endBatch` and `cancelGesture`
  (~99-111) calls `abortBatch` for `breadboard-wire-point`.
- Plan 39 provides `classifySchematicWireTarget(store, pageId, point,
  excludeWireId?)` returning `{snapped, key, kind, junctionAt?}`,
  `SCHEMATIC_LABEL_CROSSING_MESSAGE`, `SCHEMATIC_COORDINATE_RANGE_MESSAGE`
  and the notice signal. Plan 47 provides `keyCoordinate`,
  `localCoordinateForKey` and `wirePointKeys`.
  `SCHEMATIC_COORDINATE_LIMIT` comes from `@nodetto/ir`.

## Changes

- `schematic-wire-edit.ts` (pure): `rerouteSchematicWirePoint(local, index,
  target): {points: Vec[]; index: number} | null` works on stored local
  fields, and `target` is already key-preserving. Only `local[index]`
  changes; other points are copied verbatim. Toward each fixed neighbour
  that is no longer orthogonal, one elbow is inserted. It keeps the
  original segment's axis at the neighbour, and its fields are copied
  exactly from the neighbour and from the target. Exact duplicates are
  dropped, and a point landing on an adjacent point merges with it. The
  returned index is the moved or merged point, and an end stays first or
  last. Null if a segment is diagonal on exact values or fewer than two
  distinct points remain.
- `circuit.ts`:
  - `startBreadboardWirePoint` also accepts `schematic.wire`. It clears the
    point-edit notice and resets the closure-local `schematicDrop`.
  - `moveWirePoint` schematic branch. An end is classified once with
    `classifySchematicWireTarget(store, pageId, rawPointer, wireId)`. A bend
    uses the lattice point's keys. Target local fields are
    `localCoordinateForKey(key, visual)`. Order:
    1. `label-crossing`: set `schematicDrop` to the rejected result and
       write nothing. Rejection wins over any reroute outcome.
    2. Reroute from the gesture's original local points. If the result is
       non-null and every written local field and `keyCoordinate(junctionAt)`
       satisfies `Math.abs(v) <= SCHEMATIC_COORDINATE_LIMIT`, write
       `{points}` (origin unchanged) and set `schematicDrop`.
    3. On a null or out-of-range result, write nothing and keep the
       previous `schematicDrop`. Out of range also sets the range notice. No
       command is attempted, so nothing throws.
  - `finishSchematicWirePoint(gesture): "commit" | "abort"` uses the kept
    `schematicDrop` exactly. `label-crossing` sets the notice and returns
    `"abort"`. `t` and `label-single` add a junction at
    `keyCoordinate(junctionAt)`, already range-checked, and return
    `"commit"`. A bend, an unmoved gesture or a null drop returns
    `"commit"`. The function clears `schematicDrop`.
  - `nudgeSchematicWirePoint(id, index, dx, dy): number | null`. The target
    key is the stored key plus `(dx, dy) * 100`. An end is classified once
    at `keyCoordinate(key)`. Rejection, reroute and range check run before a
    batch opens. A rejected, null or out-of-range result opens no batch,
    sets the crossing or range notice, and returns null. Otherwise one batch
    applies the reroute and the junction and returns the index.
  - The notice accessor also shows a point-edit notice until the next point
    edit starts or an accepted edit or wire-tool click.
- `lifecycle.ts` `endGesture`, for `breadboard-wire-point` on a
  `schematic.wire`: call `finishSchematicWirePoint`, then `abortBatch()` on
  `"abort"`, else `endBatch()`. The cancel path is unchanged.
- `interaction/types.ts` and `interaction.ts`: expose
  `nudgeSchematicWirePoint`.

## Tests (schematic-wire-edit.test.ts; real store and createInteraction)

- Reroute (asserting the index), with pins at (0,0) and (30,20) and wire
  [(0,0),(30,0),(30,20)]: the bend dragged to (40,10) keeps both ends,
  stays orthogonal and leaves one net. A two-point start drag to (0,10)
  keeps (30,0) with one elbow. In a five-point line, untouched segments are
  identical.
- Single-wire label CLK at (0,0) inside A (-20,0)-(20,0): an end dragged
  from (0,30) to (0,0) gives one junction and one net, and one undo
  restores. With B vertical through (0,0) the drop is rejected: points,
  labels and undo stack unchanged, exact notice.
- Rejected degenerate drop: edited wire (0,30)-(0,0), CLK at (0,0) on two
  crossing wire interiors. Drag the start to (0,40), then (0,0), and release
  through `endGesture`: original geometry, nets and undo stack, no
  junction, notice shown.
- Negative tie: E at `visual = {x: -0.125, y: 0}` with local points
  [(10,30),(10,10)] (raw apply), A vertical (-10,-20)-(-10,20). E's end
  dragged to (-10,0): end key equals junction key (-1000,0), the fixed end
  is unchanged, and E and A share a net before and after `serializeDocument`
  / `parseDocument`. One undo restores. The same key equality holds through
  `nudgeSchematicWirePoint`.
- Range: S at `visual = {x: 1e9, y: 0}` with local points (0,0),(10,0).
  Dragging the start to page (0,0) writes local x `-1e9` (at the limit).
  Moving on to (-10,0) (local `-1000000010`) writes nothing, shows the range
  notice and does not throw. Release keeps the boundary position, and the
  document serializes and reloads. A nudge one pitch further left returns
  null with no batch. A T at page x `1000000010` (on a wire stored at
  `visual.x = 1e9` with local points (0,0),(20,0)) is never applied, and
  the document stays serializable.
- Nearby pin at (3,0) with the last pointer move at (4.9,4.9): end and
  junction at (0,0), the pin separate. The edited wire's own end does not
  mask the pin at pointer (2,0). Cancel leaves document and history
  unchanged.
- Nudge identity: bend of [(0,0),(30,0),(30,20)], `(id,1,0,10)` returns 2,
  `(id,2,0,10)` returns 2 (merge), and two undos restore. A labelled
  crossing returns null. A breadboard wire-point drag is unchanged.

## Verification and done criteria

- `bun test packages/ui-solid/src/schematic-wire-edit.test.ts packages/ui-solid/src/schematic-keys-move.test.ts packages/ui-solid/src/schematic-wire.test.ts packages/ui-solid/src/breadboard-interaction.test.ts` exits 0.
- `bunx biome check <the six owned .ts files>` exits 0. Earlier circuit.ts
  tests still pass, and nothing outside writePaths is edited.
