# Sequence self-messages

Status: DESIGNED, 2026-11-06 (base commit 1e8f43d, Nodetto 0.8.8)

## 1. Overview

A participant on a sequence page cannot call itself today:

- `connectByType` rejects `from === to` for everything except `state.node` and
  `erd.table` (`packages/core/src/editor/connections.ts:43`). The CLI reports
  this as "Cannot connect sequence.participant to sequence.participant here".
- The canvas drag excludes the source as a drop target, because `selfConnects`
  only allows state transitions and ERD relations
  (`packages/ui-solid/src/interaction/geometry.ts:310`).
- A `sequence.message` with equal `from` and `to` already validates, but
  `computeConnector` draws it as a 48-unit straight stub
  (`packages/core/src/shapes/connector/resolve.ts:330`).

This design adds one connect rule, one route shape, and loop-aware row and
lifeline layout. It adds no new IR type, semantic field or stored geometry
field. A self-message is any `sequence.message` whose `from` equals its `to`,
so existing documents that already hold one render as a loop without migration.

No earlier design covers this. `design-cli-ai-drawing.md` (connect picks a
message on the next row) and `design-cli-layout-merge-lint.md` (same-side
self-loops exclude `sequence.message`; sequence pages are not arrange targets)
stay correct and are unchanged.

## 2. Geometry contract

All values live in `packages/core/src/sequence-layout.ts`, so the canvas and
export cannot drift. Both already read routes from `resolveConnector`.

| Name | Value | Meaning |
| --- | --- | --- |
| `SEQUENCE_SELF_LOOP_WIDTH` | 40 | How far the loop runs right of the lifeline |
| `SEQUENCE_SELF_LOOP_HEIGHT` | 32 | Vertical run of the loop |
| `SEQUENCE_SELF_LABEL_GAP` | 8 | Gap between the loop's right leg and the label |
| `SEQUENCE_SELF_LABEL_BOUNDS_GLYPH_WIDTH` | 1.15 | Worst-case em advance per character, used only for the export viewBox (section 6) |

Helpers in the same module:

- `isSequenceSelfMessage(element)`: type is `sequence.message` and
  `semantic.from === semantic.to`.
- `sequenceMessageExtent(element)`: `SEQUENCE_SELF_LOOP_HEIGHT` for a
  self-message, otherwise 0.

Size invariant: the loop height (32) is smaller than the row pitch (52) and the
lifeline tail margin (60). Geometry the design cannot rewrite therefore stays
free of overlap:

- saved explicit `visual.y` values at the old pitch;
- Mermaid imports, which store `y = 140 + t * 52` and a lifeline bottom of
  `172 + T * 52`, so the last loop ends on or above the lifeline bottom;
- `planSequenceMove`, which swaps saved `y` values with a neighbour.

## 3. Route

In `computeConnector`, inside the existing `sequence.message` branch and before
the same-x check, when `ids.from === ids.to`, with `cx = fromCenter.x` and
`y = sequenceMessageY(element, context)`:

```text
(cx, y) -> (cx + 40, y) -> (cx + 40, y + 32) -> (cx, y + 32)
```

- The last leg runs left, so the existing `orient="auto"` arrow marker points at
  the lifeline.
- The route ignores message kind, ports, `routing` and `routingWaypoints`, as
  sequence messages already do. `sync`, `async` and `return` differ only through
  `connectorDefaultDash`, so `return` stays dashed on the loop.
- Three or more points already paint as a polyline in both renderers, and
  `style.cornerRadius` rounds it through `connectorPath`. Picking uses the same
  points through `createConnectorUtil.hitTest`, and selection bounds come from
  the same points.
- The stub branch stays for two distinct participants at the same x. That input
  keeps its current output.

## 4. Label

The label sits right of the loop and is vertically centred on it. Connector
labels are otherwise centred on an anchor using an estimated width
(`AVERAGE_GLYPH_WIDTH`), and real fonts differ from that estimate (DejaVu on
Linux is wider). A centred label could therefore run back over the loop.
Self-message text is left-aligned instead, which is independent of the font.

`ConnectorEndpoints` gains one optional field:

```ts
/** Page x of left-aligned label text. Absent means centred on labelPoint. */
readonly labelStartX?: number;
```

For a self-message, using `connectorLabelLayout` and `connectorLabelExtent`
measured at anchor (0, 0):

- `labelStartX = cx + 40 + 8`.
- `labelPoint.x = labelStartX + extent.width / 2`, or `labelStartX` for no text.
  The label box and backdrop keep centring on `labelPoint` and start at
  `labelStartX`, so the backdrop cannot cover the loop.
- `labelPoint.y = (y + 16) - (extent.y + extent.height / 2)`, or `y + 16` for no
  text. The box is centred on the loop, including wrapped labels.

Consumers:

- Paint sites `packages/core/src/svg-export/connectors.ts` and
  `packages/ui-solid/src/shapes/ConnectorView.tsx` use `x = labelStartX` and
  `text-anchor="start"` when the field is set, and today's values otherwise.
- `sameConnectorGeometry` (`packages/ui-solid/src/connector-geometry.ts`)
  compares the new field, so a canvas label cannot go stale.
- `connectorLabelBox`, canvas label picking, inline editing and text lint read
  `labelPoint` and need no change.

`labelPosition` does not apply to self-messages: the label is always beside the
loop. No UI writes this field for sequence messages and `arrange` never targets
them, so it can only come from a hand-written semantic.

## 5. Layout

Every rule adds `sequenceMessageExtent`, or a count of self-messages, which is
zero without self-messages. That is what keeps those documents byte-identical.

| Location | Rule |
| --- | --- |
| `sequenceOrderY` (omitted geometry) | `headerY + 164 + slot * 52 + 32 * (self-messages with order strictly before this order)`. Collect self-message orders in the existing element loop; do not add a pass. |
| `sequenceOrderBottomY` (new) | `sequenceOrderY` plus 32 when a self-message has that exact order. |
| `sequenceActivationShapeUtil.getBounds` | Derives `bottom` from `sequenceOrderBottomY`, so a bar ending on a self-message covers the loop. Saved `visual.height` still wins. |
| `sequenceParticipantShapeUtil.getBounds` (omitted height) | `sequenceMessageY + extent + 60 - y` per message. |
| `planSequenceMessage` | `existingY` uses `sequenceMessageY + extent` per message, so the next row is 52 below the loop's return. `requiredHeight` adds the new message's extent. |
| `planSequenceActivation` | `endY` is the last message's `y + extent`. Height and lifeline growth follow from `endY`. |
| `buildSequenceParticipant` | `bottom` uses `sequenceMessageY + extent + 60`. |

Saved geometry stays authoritative and is not rewritten on open, per the rule in
`docs/cli.md`. Row spacing therefore relies on the invariant in section 2 for
saved positions. `add` still does not grow lifelines of any message, and `connect`
remains the op that does. That behaviour is unchanged.

## 6. Export bounds

Non-BPMN connector labels are not part of the export viewBox today. A loop label
starts inside the participant box (`cx + 48` against a half-width of 80), so a
label on the rightmost lifeline would be clipped after about 8 characters.

`packages/core/src/svg-export/document.ts` adds one box to the viewBox union for
a self-message with text: `x = labelStartX`, the extent's `y` and `height`, and:

```text
width = longest wrapped line characters
        * (layout.fontSize * 1.15 + max(0, style.letterSpacing ?? 0))
```

- This is a clipping bound, not an average. Wrapping uses the 0.55 em estimate, so
  a wrapped line at the default 11 px can hold 26 characters of any width, including
  all `W`. The reviewed 0.7 em factor failed here: 26 `W` in Arial advance 269.94 px
  (0.944 em each), past its 200.2 px width plus 16 px padding.
- The 1.15 em factor is meant to cover the widest ordinary Latin glyphs in the
  default stack and its fallbacks, including bold weights, which `textStyled` can
  emit through `font-weight`. It also covers full-width (CJK) characters at 1 em.
- `textStyled` emits `letter-spacing` on the text, so positive spacing adds to each
  character. Negative spacing adds nothing, which keeps the bound conservative.
- Characters are counted per wrapped line from `connectorLabelLayout`, as
  `connectorLabelExtent` does (code points). Wrapping counts graphemes, which are
  never more numerous, so the count cannot under-measure a line.
- The cost is unused space on the right of the export, up to the bound, and only
  when a self-message label is the rightmost content.

This box only changes the viewBox. `labelPoint`, `labelStartX`, the backdrop and
label picking keep their section 4 values. No other connector contributes a new
box, so exports without self-messages stay byte-identical.

PNG and PDF are produced from this SVG, in both the Bun and the native CLI, so
they need no separate change.

## 7. Connect rule and tools

- `connectByType`: add `sequence.participant` to the types that may connect to
  themselves. `planSequenceMessage` already handles `source === target`, locked
  ends return null, and every other element type keeps its rejection and error.
  `Editor.connect` and the component and use-case connectors keep refusing.
- CLI: `connect` needs no code change because it calls `connectSmart`.
  `label` and `semantic.kind` already apply through the existing patch path, and
  `{"op":"connect","shape":"sequence.message",...}` reaches `connectSmart` too.
- Message kinds: `MESSAGE_KINDS` is `sync`, `async`, `return`. The reply kind is
  `return`, and no alias or new enum value is added (see user-QA Q1).
- Canvas: `selfConnects` also returns true for `sequence.message`, so the message
  tool (`Tool.SequenceMessage`) can drop on its source. `finishConnecting`
  extends the ERD click guard to `sequence.message`: ending on the source needs a
  drag of at least 4 screen pixels, so a click on a lifeline creates nothing.
- Port-handle and generic connector drags keep treating the source as "no target"
  (see user-QA Q2). Reconnect gestures are unchanged and still exclude the other
  end.
- Hit-testing: the loop lies entirely inside the participant's rectangular hit
  box, so picking depends on `pagePaintOrder`. A message created by a tool has a
  higher z-index than its participant, so the loop is expected to pick first. This
  was read from the code and not executed. The core plan must add a test that
  picks the loop's right leg in `packages/core/src/hit-test.test.ts`. If the
  participant wins, `sequenceParticipantShapeUtil.hitTest` must defer to a
  self-message on that participant whose route is within tolerance of the point.

## 8. Native CLI and adapters

- `apps/cli/native` has no sequence-specific code and runs the shared engine, so
  it needs no change. Rebuilding the release binary is enough.
- Mermaid and D2 export have no `from !== to` guard, and the Mermaid import regex
  accepts equal endpoints. draw.io export skips every sequence message with its
  existing fallback. No adapter changes.
- `rotation.ts`, `aspect-ratio.ts`, `selection-resize.ts`, `arrange-route.ts` and
  `shape-warnings.ts` treat messages independently of the route shape. No changes.

## 9. Help and docs

- `help.ts`, edit `connect`: state that a sequence participant may connect to
  itself, creating a self-call loop on the next row; list kinds `sync`, `async`,
  `return`. Keep the existing table and state sentence.
- `help.ts`, `types`: mention that `types sequence.message` describes self-messages.
- `types-command.ts`: for `sequence.message` only, add a text note line and a JSON
  `notes` array. All other types keep byte-identical output.
- `docs/cli.md`: extend the sequence paragraph near line 201.
- `README.md`: no change unless its connect summary contradicts the new rule.

## 10. Verification

Fixtures are self-authored with neutral names such as widgets and orders.

Core and export (`packages/core/src`):

- Route points, marker and dash for all three kinds, and the stub for distinct
  participants at the same x.
- Label: `text-anchor="start"`, `x = cx + 48`, and the label box centred on the
  loop.
- Bounds on the rightmost lifeline, from the viewBox attribute and the section 6
  formula, with no font-specific width: 26 `W` at `fontSize` 11 and `fontFamily`
  Arial; 6 `W` with `letterSpacing` 20; negative `letterSpacing` adds nothing; a
  wrapped label uses its longest line. A connector other than a self-message adds
  no box.
- Layout: a message after a self-message clears the loop's bottom, for omitted
  geometry and for `planSequenceMessage`. Activation and lifeline bottoms cover a
  trailing loop. An existing document with a saved-`y` self-message now paints a
  loop, stated explicitly as the requested change.
- Rule: self-connect on a locked participant returns null. A self-connect on
  `uml.class` and `usecase.node` still returns null.
- Golden: expected SVGs are committed as literal fixtures, captured from base
  commit 1e8f43d before any layout code changes. They cover
  `packages/io/src/__fixtures__/sequence.jsonl` and one authored omitted-geometry
  document with activations. No hash derived from the changed code may be used.

Canvas (`packages/ui-solid/src`):

- `interaction-connectors.test.ts`: a message-tool drag on one participant creates
  a self-message; a click creates nothing; undo removes it in one step.
- Component test: the repo has no DOM test harness and adding one is out of scope.
  `ConnectorView.tsx` exports a pure helper for its label text attributes (`x`,
  `text-anchor`), and a test imports it through the `.tsx` module, following the
  `text-note-view.test.ts` precedent. The same test checks route points and
  `editor.hitTest` on the loop's right leg, and `sameConnectorGeometry` for a
  `labelStartX` change.

CLI (`apps/cli/src`):

- `edit` connect from `@a` to `@a` for `sync`, `async` and `return`, with a label.
- Bun and native parity for the edited document and for SVG export.
- PNG and PDF: assert the output exists and, for PNG, that ink appears on the
  loop's right leg. Assert no font-specific text widths, so the test passes with
  only DejaVu fonts.
- PNG containment with whatever font the platform resolves, on a transparent or
  known background: for both section 6 reproductions (26 `W`; 6 `W` with
  `letterSpacing` 20) on the rightmost lifeline, ink appears right of the loop and
  the outermost pixel columns of the image hold no ink. Clipped text would reach
  the edge, so this checks the real glyphs on Linux with DejaVu and on macOS. Run
  it through the native binary and rasterizer.
- Help and `types sequence.message` text.

Performance: compare release-binary `/usr/bin/time -p` CPU time before and after,
exporting a 200-message sequence document with 20 self-messages. Keep the new code
free of per-point destructuring and regex splits, and never relax a test deadline.

Commands: per plan, targeted `bun test <files>` and `bun run typecheck`. Finally,
`mise run verify` and `mise run test-cli`, with a 3-attempt retry on native
deadline timeouts. Shared core uses no unchecked index access.

## 11. Delivery boundaries

Plans depend only on the contract in sections 2 to 4.

| Wave | Plan | Owns |
| --- | --- | --- |
| 1 | Core | `sequence-layout.ts`, `shapes/sequence.ts`, `shapes/connector/resolve.ts`, `shapes/connector/route.ts`, `editor/sequence.ts`, `editor/connections.ts`, `svg-export/connectors.ts`, `svg-export/document.ts`, adjacent tests, golden fixtures |
| 2 | Canvas | `interaction/geometry.ts`, `interaction/connectors.ts`, `shapes/ConnectorView.tsx`, `connector-geometry.ts`, adjacent tests |
| 2 | CLI | `types-command.ts`, CLI and native parity tests |
| Wiring | Docs | `help.ts`, `docs/cli.md`, `README.md`, help tests, and `packages/core/src/index.ts` only if a new export is needed |

The canvas reads `labelStartX` from the existing `ConnectorEndpoints` type, so no
new root export is expected.

## 12. Accepted limits

- `scale` with a factor well below 1 on a sequence page can shrink saved row
  spacing below the fixed loop height. The loop does not scale with it.
- A label in a custom `fontFamily` whose glyphs advance more than 1.15 em can still
  clip on the rightmost lifeline. Connector labels on other messages have no viewBox
  protection at all today, and that stays unchanged.
