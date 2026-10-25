# breadboard-12-ui-canvas-interaction

- planId: breadboard-12-ui-canvas-interaction
- planPath: impl-plans/completed/breadboard-12-ui-canvas-interaction.md
- wave: 5; dependsOn: breadboard-06-core-editing, breadboard-07-core-connectivity-erc, breadboard-10-core-ratsnest-parity,
  breadboard-15-ui-export-dialog (checkpoint amendment 2: plan 15 pins bun
  to 1.4.0 in mise.toml; run `test "$(bun --version)" = "1.4.0"` before any
  gate, then `bun test packages/ui-solid/src/Toolbar.test.ts` must pass
  unedited; write the ASCII sentinel output to
  tmp/breadboard-mode-s485/breadboard-12-ui-canvas-interaction/ascii-sentinel.log)
- design: design-docs/specs/design-breadboard.md sections 7.2
  (workspace, palette, wire tool, keys), 4.2 (move snapping), 5.2 (net
  highlight target order, probe clearing), 5.3 (ratsnest overlay);
  user-QA Q3
- progress log: impl-plans/progress/breadboard-12-ui-canvas-interaction.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/ui-solid/src/(tools|workspaces|shape-palette|interaction|Canvas|BreadboardOverlay|breadboard-overlay|breadboard-palette\.test|breadboard-interaction\.test)`

## Completion (session-490)

- Status: COMPLETE. Accepted by test-integrity, adversarial and the
  session-490 serial integration review (comm-009184, all 18 plans on the
  combined tree); archived to `impl-plans/completed/` in Step 8.
- Combined-tree verification: `mise exec -- bun run typecheck` exit 0;
  `mise exec -- bun test --path-ignore-patterns 'tmp/**'` exit 0 (2501 pass,
  18 skip, 0 fail); `CARGO_TERM_QUIET=true mise run lint` exit 0;
  `CARGO_TERM_QUIET=true mise exec -- cargo test --workspace` exit 0.
  Evidence (local, untracked): `tmp/breadboard-mode-s485/reconcile-s490/`.
- Open item owned by `breadboard-00-overview`, which stays in
  `impl-plans/active/`: `CARGO_TERM_QUIET=true mise run verify` exited 1
  because its `bun test` also collects git-ignored scratch copies under
  `tmp/breadboard-mode-s485/breadboard-05-collab/`
  (RECON-S490-W1-VERIFY-TMP-SCRATCH).
- The sections below are the dispatch-time plan.

## Intent

Make breadboard pages usable on the canvas:
- a `breadboard` workspace with its palette tools
- part and board creation through `Editor.createBreadboardPart`
- a click-by-click wire tool with snapped points
- `r` / `Shift+R` rotation on breadboard selections only
- lattice snapping on move gestures
- the transient net-highlight and ratsnest overlays, both memoised per
  store revision

## Non-goals

- No inspector (plan 13), no problems panel (plan 14) and no desktop
  wiring (plan 17).
- No change to `TOOL_KEYS`: `r` keeps the rectangle tool everywhere
  except as stated below.
- Nothing from the overlays is written to the document or to SVG export.

## writePaths

- packages/ui-solid/src/tools.ts
- packages/ui-solid/src/workspaces.ts
- packages/ui-solid/src/shape-palette.ts
- packages/ui-solid/src/interaction.ts
- packages/ui-solid/src/Canvas.tsx
- packages/ui-solid/src/BreadboardOverlay.tsx (new)
- packages/ui-solid/src/breadboard-overlay.ts (new: pure overlay model)
- packages/ui-solid/src/breadboard-palette.test.ts (new)
- packages/ui-solid/src/breadboard-interaction.test.ts (new)
- impl-plans/progress/breadboard-12-ui-canvas-interaction.md

## sharedPaths

none

## Contracts (pinned; plan 17 relies on `"breadboard"` as a WorkspaceId)

- `WorkspaceId` gains `"breadboard"`. The `WORKSPACES` entry is
  `{id: "breadboard", label: "Breadboard", design: false, shapes: false}`
  with primary tools Half board, Resistor, LED, Push button and Wire.
- `Tool` gains these kinds:
  - `breadboard:board-full`, `breadboard:board-half`,
    `breadboard:board-mini`
  - `breadboard:resistor`, `breadboard:led`
  - `breadboard:capacitor-ceramic`, `breadboard:capacitor-electrolytic`
  - `breadboard:diode`, `breadboard:npn`, `breadboard:pnp`
  - `breadboard:button`, `breadboard:potentiometer`
  - `breadboard:ic`, `breadboard:header`, `breadboard:battery`
  - `breadboard:wire`
- `BREADBOARD_TOOLS` lists them in that order. `creationFor` returns a
  `CreationTool` with the `breadboard.*` type and the semantic overrides
  (board size, capacitor style, transistor polarity).
- The interaction API gains:
  - `readonly wireDraft: Accessor<readonly Vec[] | null>`
  - `readonly breadboardHover: Accessor<BreadboardPinRef | { wireId: ElementId } | null>`
- `breadboard-overlay.ts`:
  ```ts
  export interface BreadboardOverlayModel { highlight: BreadboardHighlight | null; ratsnest: readonly RatsnestLine[] }
  export function breadboardOverlayModel(document: Document, pageId: PageId, input: { hover: BreadboardPinRef | { wireId: ElementId } | null; probe: BreadboardProbe | null; selection: readonly ElementId[] }): BreadboardOverlayModel;
  ```
  The highlight target order is: hover pin, then hover wire, then the probe
  pin, then the single selected wire (design 5.2).

## File-level changes

### tools.ts, workspaces.ts, shape-palette.ts

- Imitate the BPMN entries (`BPMN_TOOLS` tools.ts:154, `BPMN_CREATIONS`,
  the `bpmn` workspace at workspaces.ts:87, and `BPMN_SHAPES` /
  `PRIMARY_TOOLS` in shape-palette.ts:290).
- `PRIMARY_TOOLS.breadboard` lists the 5 primary tools.
- `additionalShapes("breadboard")` returns the remaining breadboard
  shapes plus `COMMON_SHAPES`, as `bpmn` does at shape-palette.ts:316.
- Add palette icons by reusing existing icon names where they exist.
  Otherwise use a simple generic icon. Do not add icon artwork from any
  third party.

### interaction.ts

- `placeShape` (interaction.ts:1356): for `breadboard:*` creation tools
  other than the wire, call `editor.createBreadboardPart(type, point, semantic)`,
  select the result and return to the select tool. Imitate the
  `Tool.Port` and `bpmn:lane` branches.
- Wire tool:
  - each click adds `snapBreadboardPoint(point)`, skipping a point equal
    to the last one
  - `wireDraft` exposes the points plus the snapped pointer while active
  - double-click or Enter finishes with at least 2 distinct points; the
    wire is created through `createBreadboardPart("breadboard.wire", first, {points})`
    with points relative to the first point
  - Esc cancels; fewer than 2 points creates nothing
- Wire editing on a selected wire:
  - endpoint and bend handles drag with `snapBreadboardPoint`
  - double-click on a segment inserts a bend point
  - double-click on a bend point removes it
  - all edits go through `updateBreadboardSemantic(id, {points})`
- Keys: when the current page kind is `breadboard` and the selection holds
  at least one breadboard part type, `r` calls
  `rotateBreadboardParts(ids, 1)` and `Shift+R` calls it with `-1`, and
  the event is consumed. Otherwise fall through to the existing
  `TOOL_KEYS` handling (interaction.ts:187) unchanged.
- Move snapping: in the `translating` case (interaction.ts:1682-1720),
  when `snapFor(...)` is not null and `isBreadboardSnapTarget(store, ids)`
  is true:
  - replace the `snapTranslate` correction with
    `snapBreadboardDelta(store, page, ids, {dx, dy})`
  - clear the guides
  - otherwise keep the existing path unchanged
- Hover: on pointer move with no gesture, set `breadboardHover` from
  `breadboardPinAt`, else from a hit-tested wire, else null. Only do this
  on breadboard pages.
- Probe clearing: a canvas click on empty space or on an element, or Esc,
  calls `editor.setBreadboardProbe(null)`.

### Canvas.tsx and BreadboardOverlay.tsx

- Mount `<BreadboardOverlay>` inside the existing overlay layer
  (`<svg class="nodetto-layer nodetto-overlay-layer">`, Canvas.tsx:1005),
  only when the current page kind is `breadboard`.
- The overlay draws:
  - ratsnest lines, thin and dashed (0.15 pitch), with class
    `breadboard-ratsnest`
  - highlight rings on holes and pins, and a glow on wires, with class
    `breadboard-net-highlight`
  - the wire draft polyline
- Memoise `breadboardOverlayModel` on the editor revision signal, the
  hover, the probe (`onBreadboardProbeChange`) and the selection. Because
  a drag writes to the store on every move, the overlay follows drags
  live.

## Pitfalls

- `r` must still select the rectangle tool on non-breadboard pages, and
  on breadboard pages when no breadboard part is selected (Q3).
- The `PRIMARY_TOOLS` `satisfies Record<WorkspaceId, ...>` forces the new
  entry. Search for other exhaustive `WorkspaceId` switches in your owned
  files and update them. If one is outside your writePaths (for example in
  apps/desktop), record it under Open issues; plan 17 owns App.tsx.
- `creationFor` is exhaustive by design: add every new tool to the switch.
- Generic `TOOLS` loops in `interaction.test.ts` and `viewer-actions.test.ts`
  iterate every tool. The new tools must pass them unedited, so each needs
  a creation and a placement path.
- Do not touch `ShapeView.tsx` (plan 11) or the Inspector (plan 13).

## Tests (input -> expected)

`breadboard-palette.test.ts`:
- `workspaceById("breadboard")` -> label "Breadboard", the 5 primary
  tools in order
- `workspaceShapes("breadboard")` -> 5 items
- `additionalShapes("breadboard")` -> includes every other breadboard tool
- `creationFor("breadboard:board-mini")` -> type `breadboard.board` with
  semantic size `mini`
- `creationFor("breadboard:capacitor-electrolytic")` -> style
  `electrolytic`
- every `BREADBOARD_TOOLS` entry -> non-null `creationFor`

`breadboard-interaction.test.ts`, using the existing interaction test
harness patterns in `interaction.test.ts`:
- placing a resistor at (33,47) -> an element with pin 1 at (30,50) and
  reference R1
- wire tool clicks at (12,9), (40,9), (40,31), then Enter -> a wire with
  points [(0,0),(30,0),(30,20)] at visual (10,10)
- wire tool with 1 click, then Enter -> nothing created; Esc -> draft
  cleared
- `r` on a breadboard page with a resistor selected -> rotation 90;
  `Shift+R` -> back to 0
- `r` on a breadboard page with nothing selected -> the rectangle tool
- `r` on a freeform page -> the rectangle tool
- dragging a resistor by (7,4) with snapping on -> pin 1 lands on the
  lattice; with snapping off -> it moves by exactly (7,4)
- `breadboardOverlayModel`:
  - a hover pin wins over the probe
  - the probe wins over the selected wire
  - no target -> highlight null
  - a target netlist with an unrouted net -> 1 ratsnest line; after
    adding a wire that routes it -> 0
- Esc -> `editor.breadboardProbe()` is null

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-12-ui-canvas-interaction
bun test packages/ui-solid/src/breadboard-palette.test.ts packages/ui-solid/src/breadboard-interaction.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/ui-solid > tmp/breadboard-mode-s485/breadboard-12-ui-canvas-interaction/ui.log 2>&1   # G2 (interaction.test.ts, workspaces.test.ts, Toolbar.test.ts unedited and green)
bun run typecheck > tmp/breadboard-mode-s485/breadboard-12-ui-canvas-interaction/typecheck.log 2>&1     # G1
bunx biome check packages/ui-solid/src/tools.ts packages/ui-solid/src/workspaces.ts packages/ui-solid/src/shape-palette.ts packages/ui-solid/src/interaction.ts packages/ui-solid/src/Canvas.tsx packages/ui-solid/src/BreadboardOverlay.tsx packages/ui-solid/src/breadboard-overlay.ts packages/ui-solid/src/breadboard-palette.test.ts packages/ui-solid/src/breadboard-interaction.test.ts   # exit 0
git diff --quiet -- packages/ui-solid/src/interaction.test.ts packages/ui-solid/src/workspaces.test.ts packages/ui-solid/src/Toolbar.test.ts   # exit 0
```

## Done criteria

- `grep -n 'r: "geo:rect"' packages/ui-solid/src/interaction.ts` still prints the unchanged TOOL_KEYS line.
- All verification lines pass, with exit codes and counts in the progress log.
