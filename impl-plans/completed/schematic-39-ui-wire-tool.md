# schematic-39-ui-wire-tool

- planId: schematic-39-ui-wire-tool; wave 10; dependsOn: schematic-36-ui-creation,
  schematic-47-core-snap-exclude
- design: sections 3.3 (key-preserving writes, range check) and 7.3 wire
  tool, section 13 decision 20 (revision 12); progress log
  impl-plans/progress/schematic-39-ui-wire-tool.md
- revision: 8 (SCH-DESIGN-WIRE-STORED-RANGE, comm-000006; -CANONICAL-CONTACT,
  -REJECTED-DOUBLE-CLICK, comm-000004; comm-000052, -000050, -000048)

## Intent

The schematic wire tool. Crossings and unjoined T connections stay
separate, live and after reload, and every committed field is in range. It
reuses the existing draft (Esc, Enter, preview), and plan 45 shows its
notice. Non-goals: no edits to `keyboard.ts`, `context.ts` or `creation.ts`,
no overlay or point editing (45, 46), and breadboard behaviour and
`TOOL_KEYS` unchanged.

## writePaths

- packages/ui-solid/src/interaction/schematic-wire.ts (new),
  packages/ui-solid/src/schematic-wire.test.ts (new), interaction/circuit.ts,
  interaction/pointer.ts (one branch), src/interaction.ts and
  interaction/types.ts (one field each)
- impl-plans/progress/schematic-39-ui-wire-tool.md, target, tmp/cad3d
  (artifactRoots: target, tmp/cad3d; sharedPaths: none)

## Repository context

- Draft: `state.wirePoints`, `ctx.wireDraft`, `ctx.isSchematicPage()` (plan
  36). Esc (`keyboard.ts` `pressEscape`) clears it; Enter calls
  `finishWireDraft`. Canvas sends two `onPointerDown`s, then
  `handleDoubleClick` (`Canvas.tsx` ~459 and ~489).
- Plan 47 core: `schematicPinAt(..., excludeId?)` with `target.key`,
  `schematicContactsAt(store, pageId, key, excludeId?)`, `keyCoordinate`
  and `localCoordinateForKey`.

## Changes

- `schematic-wire.ts` (pure, real store, no DOM):
  - `classifySchematicWireTarget(store, pageId, point, excludeWireId?)`
    returns `{snapped, key, kind: "joinable" | "lattice" | "t" |
    "label-single" | "label-crossing", junctionAt?}`. Steps:
    1. Rank with `schematicPinAt(..., excludeWireId)`. `key` is
       `target.key`, or else the lattice point's coordinate keys.
    2. Count with `c = schematicContactsAt(store, pageId, key,
       excludeWireId)`, once.
    3. If `c.labels` is non-empty and `c.joinables === 0`: one wire gives
       `label-single` with `junctionAt = key`, two or more give
       `label-crossing`, and none gives `joinable`.
    4. Else if there is a target, or `c.joinables > 0`: `joinable`.
    5. Else if `c.wires.length === 1`: `t` with `junctionAt = key`.
    6. Else `lattice`.
    `snapped = keyCoordinate` of each key axis. Exported for plan 46.
  - `resolveSchematicWireClick(store, pageId, point, points, shiftKey)`
    returns `{action: "add" | "finish" | "reject"; points; keys;
    pendingJunction?; message?}`. It adds the orthogonal corner (horizontal
    first, vertical first with Shift) and finishes on a joinable target
    other than the draft start. Each accepted `t` or `label-single` click
    returns `junctionAt` as `pendingJunction`, unless the point lies on the
    draft's own earlier path. `label-crossing` gives `reject` with
    `message` exactly `SCHEMATIC_LABEL_CROSSING_MESSAGE` (exported: `"Label
    is on a crossing; add a junction or move the label"`).
  - `schematicWirePreview(store, pageId, points, pointer, shiftKey)`.
- `circuit.ts`:
  - Closure-local `startJunction` and `lastJunction` (keys or null), the
    kept key of each draft point, and `lastClickRejected: boolean`. Each
    accepted click replaces `lastJunction`, with null when it has none.
    All of them are cleared when the draft empties.
  - `placeSchematicWirePoint(point, shiftKey)` applies the resolution and
    sets `lastClickRejected`. A reject leaves the draft unchanged and sets
    the notice. `finish` calls `finishWireDraft`.
  - Notice signal `schematicWireNotice`: cleared on an accepted click, on
    finish and when the draft empties. The accessor yields null unless
    `options.tool() === Tool.SchematicWire`. Plan 46 widens it.
  - `finishWireDraft` (schematic page and tool): the wire gets per axis
    `visual = keyCoordinate(clamp(K0, -1e11, 1e11))` and local points
    `localCoordinateForKey(Ki, visual)`. Each distinct pending junction goes
    to `keyCoordinate(K)`, skipping existing junction keys. Nothing is
    classified again, and fewer than 2 distinct keys commits nothing. If
    any derived field has `Math.abs(v) > SCHEMATIC_COORDINATE_LIMIT`
    (`@nodetto/ir`), nothing is applied. The draft stays as it was before
    the finishing action (a finishing target click is not appended and sets
    `lastClickRejected`), and the notice becomes the exported
    `SCHEMATIC_COORDINATE_RANGE_MESSAGE` (`"Wire is outside the coordinate
    range"`). Otherwise one apply batch commits everything.
  - `handleDoubleClick` (schematic wire): does nothing when the draft is
    empty or `lastClickRejected`. Otherwise it finishes exactly like Enter.
    `updateIdleHover` previews with `event.shiftKey`.
- `pointer.ts`: before `if (creationFor(tool))` add
  `if (tool === Tool.SchematicWire) { circuit.placeSchematicWirePoint(point,
  event.shiftKey); return; }`.
- `interaction/types.ts`: add `readonly schematicWireNotice: Accessor<string |
  null>;` after `wireDraft`. `interaction.ts`: the matching field.

## Tests (schematic-wire.test.ts; real store and createInteraction, no DOM)

- Through `onPointerDown`: start (0,0), click (30,20), Enter gives stored
  points (0,0),(30,0),(30,20). With Shift on the second click it gives
  (0,0),(0,20),(30,20), and the Shift hover preview shows the same corner.
- A deliberate T at the start connects with a junction. An endpoint snap on
  B's end lying on A's interior joins B only. A plain-crossing finish adds
  no junction.
- Two junctions: vertical wires at x=0 and x=40 (y -20..20) with
  distinct-name labels at (0,0) and (40,0). Start on one, finish on the
  other: two junctions, one net, and one undo removes all three elements.
- Classify once (pin at (3,0), A from (-20,0) to (20,0)): start at (0,40),
  click (4.9,4.9), Enter. The end and the junction are at (0,0), A is
  joined, and the pin stays on a separate net. Instead, click (0,-30) and
  press Enter: the bend at (0,0) adds no junction.
- Canonical crossing: A from (-20,0) to (20,0), B at `visual.x = 0.004`
  with local points (0,-20),(0,20), CLK at (0,0). A click at (0,0) is
  rejected with the exact notice and no junction, and A and B stay on
  separate nets. Repeat after `serializeDocument` / `parseDocument` into a
  fresh store: same result.
- Rejected double-click: two accepted points away from it, then two
  rejected pointer-downs on the labelled crossing and `handleDoubleClick`.
  Draft, document, undo stack and notice are unchanged. An accepted
  double-click elsewhere commits exactly one wire.
- Range: S at `visual.x = 1e9` with local points (0,0),(10,0). A wire from
  S's far end to 10 units lower is stored at `visual.x = 1e9` with local x
  10 (a field at the limit is written) and serializes and reloads. Start
  (0,0), click the lattice point nearest (0, 1.5e9), then Enter: declined,
  with document, undo stack and draft unchanged, range notice shown, and
  `serializeDocument` still succeeds.
- Esc after a pending start junction: document unchanged, draft null. Enter
  with 3 points gives one wire, and undo removes it. Palette `placeTool`
  changes nothing. The notice is null outside the wire tool.

## Verification and done criteria

- `bun test packages/ui-solid/src/schematic-wire.test.ts packages/ui-solid/src/schematic-interaction.test.ts packages/ui-solid/src/breadboard-interaction.test.ts` exits 0.
- `bunx biome check <the six owned .ts files>` exits 0. `pointer.ts` gains
  one branch, `interaction.ts` and `types.ts` one field each, and nothing
  outside writePaths is edited.

## Amendment 2026-11-27 (integration-paths-outside-writePaths, round 1)

Finding INT-S933-W14-CAD-EMITTER-CIRCUIT (integration review, mid). The
wire-tool commit (circuit.ts, about line 165) and plan 46's drop junction
(`addDropJunction`, about line 449) emit `createElement` commands from
`interaction/circuit.ts`. The exact-list CAD audit test "every createElement
emitter is classified in design section 4" (`emitters.test.ts`, about line
249) now fails, with 6 pass / 1 fail. Because of that, the full `bun test`
and `mise run verify` also fail. The reviewer's logs are
/tmp/ir-s933-emitters.log and /tmp/ir-s933-full-bun-test.log.

Scope of this redispatch: the wire tool itself is done and accepted
downstream (plans 41, 45 and 46 depend on it). The only remaining work is the
audit-list extension below. Follow the precedent of plan 26, which added
`packages/core/src/schematic/target-card.ts` as "B".

- writePaths added: `packages/core/src/cad/emitters.test.ts` and
  `design-docs/specs/design-cad3d.md`. No other plan owns either file.
  `sharedPaths` stays empty.
- Change 1: in `classifiedEmitters` in `emitters.test.ts`, add
  `"packages/ui-solid/src/interaction/circuit.ts": "C"` next to the
  `connectors.ts` and `creation.ts` "C" entries.
- Change 2: in section 4 of `design-cad3d.md`, row "C. Canvas interaction",
  add `interaction/circuit.ts` to the list of UI paths, with the note
  "schematic wire tool commits and wire point-edit junctions, schematic pages
  only". Keep the guard column. The command layer enforces rule R.
- Change 3: append a dated entry to this plan's progress log. Record the
  finding ID, this writePaths amendment, the pre and post sha256 of the two
  edited files, and the log paths under
  `tmp/schematic-s933/schematic-39-ui-wire-tool/`.
- Forbidden:
  - Do not edit `circuit.ts`, `pointer.ts`, `interaction.ts`,
    `interaction/types.ts`, `lifecycle.ts` or `schematic-wire*.ts`.
  - Do not remove, reorder or reclassify any existing `classifiedEmitters`
    entry, and do not weaken the `toEqual` exact-list assertion or the file
    scan.
  - Do not change any other row of the design table, or the M22 or rule-R
    text.
  - No production code change, no git write operations, and no edit to the
    dispatch manifest.
- Done when:
  - `bun test packages/core/src/cad/emitters.test.ts` exits 0 with 7 pass /
    0 fail.
  - `bunx biome check packages/core/src/cad/emitters.test.ts` exits 0.
  - The gates for plan 39 and plan 46 (schematic-wire, schematic-wire-edit,
    schematic-interaction, breadboard-interaction and schematic-keys-move
    tests) still exit 0.
  - `shasum -a 256 -c` reports all OK on
    `tmp/schematic-s933/schematic-46-ui-wire-point-edit/post-hashes.txt` and
    `tmp/schematic-s933/schematic-45-ui-wire-overlay/post-hashes.txt`.
  - `git diff 48c1100 -- packages/core/src/cad/emitters.test.ts` shows only
    the `target-card.ts` and `circuit.ts` additions.
