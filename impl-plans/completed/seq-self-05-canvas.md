# seq-self-05-canvas

Workflow mode: `issue-resolution`. Manifest: `impl-plans/active/seq-self-s750-dispatch.json`. Wave 2;
dependsOn: `seq-self-01-contract`. Design: `design-docs/specs/design-sequence-self-messages.md` sections 4, 7 and 10.
Evidence: `tmp/seq-self-s750/seq-self-05-canvas/`. Progress: `impl-plans/progress/seq-self-05-canvas.md`.

## Intent and context

The app's message tool must create a self-message by dragging on one participant, and the canvas must paint the label beside the
loop. The loop line already paints: three or more route points use the existing polyline in `ConnectorView.tsx`.

Contract from plan 01: `ConnectorEndpoints.labelStartX?: number`, and `connectSmart(a, a)` returns a message.

## Non-goals

- Only `Tool.SequenceMessage` may self-connect (user-QA Q2 default). Port-handle and generic connector drags keep cancelling when
  dropped on the source.
- Reconnect gestures are unchanged.
- No edit to `apps/desktop`, `packages/core` or `overlay-targets.ts`, `ShapeView.tsx` or `creation.ts`. No DOM test library: do not add
  any dependency.

## File-level changes

1. `packages/ui-solid/src/interaction/geometry.ts`, `selfConnects`: also true for `"sequence.message"`.
2. `packages/ui-solid/src/interaction/connectors.ts`, `finishConnecting`: extend the guard that nulls `target` so it applies to
   `erd.relation` or `sequence.message`. A drop on the source under 4 screen pixels is a click and creates nothing. Update the comment.
3. `packages/ui-solid/src/shapes/ConnectorView.tsx`: export a pure helper with this signature:

   `export function connectorLabelTextAttrs(resolved: ConnectorEndpoints): { readonly x: number; readonly textAnchor: "start" | "middle" }`

   It returns `labelStartX` and `"start"` when set, otherwise `labelPoint.x` and `"middle"`. Use it for the `<text text-anchor>` and each
   `<tspan x>` of the label. The backdrop still uses `labelPoint`. `TextNoteView.tsx:textNoteStyle` is the precedent for an exported pure helper.
4. `packages/ui-solid/src/connector-geometry.ts`, `sameConnectorGeometry`: also compare `a.labelStartX === b.labelStartX`, so a canvas label
   cannot go stale.

## Pitfalls

- `moveConnecting` already calls `selfConnects`, so the hover target follows without another edit.
- `state.transition` keeps creating on click. Do not extend the guard to it.
- `canDrawFree` is false for `sequence.` sources under the message tool, so no free line can appear. `Tool.Connector` is true there: with it,
  a drop on the source must keep creating nothing, because `selfConnects(undefined)` stays false.
- Keep `resolved()` reactive inside the JSX. Call the helper from an accessor, not once at setup.
- Do not import `solid-js/web` or render the component in tests; the repo has no DOM harness.

## Tests

`packages/ui-solid/src/interaction-connectors.test.ts` (extend). Imitate `interactionFor`, `pointer` and the drag flow already in this file,
with a participant at x=0, y=0, width=160, height=300 and `interactionFor(editor, Tool.SequenceMessage)`:

- Press on the lifeline, move 40 px down, release on the same participant -> exactly one `sequence.message` with from and to equal; it is selected.
- Press and release at the same point -> no message.
- Move 2 screen pixels and release -> no message.
- After the drag, `editor.undo` once -> message gone, and `history.undoSize` returned to its value before the drag.
- Locked participant -> no message.
- `Tool.Connector` drag ending on the source -> no element created.
- `Tool.StateTransition` click on a state node -> still creates a transition (regression).

`packages/ui-solid/src/connector-view-self-message.test.ts` (new). Import the helper through `./shapes/ConnectorView.tsx`, following
`text-note-view.test.ts`:

- Endpoints with `labelStartX` 128 -> `{ x: 128, textAnchor: "start" }`.
- Endpoints without it -> `{ x: labelPoint.x, textAnchor: "middle" }`.
- `sameConnectorGeometry` on two routes differing only in `labelStartX` -> false; identical routes -> true.
- A real `Editor` self-message resolved with `resolveConnector` -> the four expected points, and `editor.hitTest` on the right leg returns the message.

## Verification

Each command must exit 0.

- `bun test packages/ui-solid/src/interaction-connectors.test.ts packages/ui-solid/src/connector-view-self-message.test.ts packages/ui-solid/src/connector-routing.test.ts packages/ui-solid/src/interaction-creation.test.ts`
- `bun run typecheck`
- `bunx biome check packages/ui-solid/src/interaction/geometry.ts packages/ui-solid/src/interaction/connectors.ts packages/ui-solid/src/shapes/ConnectorView.tsx packages/ui-solid/src/connector-geometry.ts packages/ui-solid/src/interaction-connectors.test.ts packages/ui-solid/src/connector-view-self-message.test.ts`

If a failure comes from a file another wave 2 plan owns, read it fresh, re-run once it is stable, and do not edit it. If the `hitTest` case
fails, plan 03 owns the fallback: record it and re-run after plan 03 lands.

## Acceptance criteria

- All test cases exist and pass.
- `package.json` files and `bun.lock` are unchanged.

## Working rules

Before each edit, read the file fresh and record its sha256 in the progress log; record it again afterwards. If a file
changed unexpectedly, stop and report the drift. Edit only your writePaths. Never use worktrees, private branches or
concurrent git operations. Do not commit or archive plans. Fixtures use neutral text only. No emojis. The progress log
records each step, command, exit status and complete log path under the evidence directory.
