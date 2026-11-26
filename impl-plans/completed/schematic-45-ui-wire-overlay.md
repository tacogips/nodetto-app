# schematic-45-ui-wire-overlay

- planId: schematic-45-ui-wire-overlay; wave 13;
  dependsOn: schematic-39-ui-wire-tool, schematic-41-ui-keys-drag,
  schematic-46-ui-wire-point-edit
- design: section 7.3 Wire tool (visible draft, snap feedback, notice) and
  "Wire point editing" rule 6 (keyboard handles)
- progress log: impl-plans/progress/schematic-45-ui-wire-overlay.md
- revision: 5 (SCH-DESIGN-HANDLE-KEYBOARD from comm-000050: focus follows
  the resulting index returned by plan 46; comm-000048: the drag
  semantics of SCH-DESIGN-DRAG-LABEL and SCH-DESIGN-DRAG-ANCHORS moved to
  plan 46; earlier SCH-PLAN-001..004)

## Intent

Show the schematic wire draft and the notice on the canvas, and draw
focusable, keyboard-operable point handles for a selected schematic wire.
These handles call plan 46's drag and nudge entry points. Everything is
transient UI, and nothing extra is written to the document or the SVG.

## Non-goals

- No edits to `circuit.ts`, `lifecycle.ts`, `keyboard.ts`, `interaction.ts`
  or `interaction/types.ts` (39 and 46 own them; this plan only reads).
- Breadboard overlay and handles unchanged.

## writePaths

- packages/ui-solid/src/SchematicOverlay.tsx (new)
- packages/ui-solid/src/schematic-overlay.ts (new)
- packages/ui-solid/src/schematic-overlay.test.ts (new)
- packages/ui-solid/src/Canvas.tsx
- impl-plans/progress/schematic-45-ui-wire-overlay.md, target, tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `schematic-overlay.ts` (pure; imitate `breadboard-overlay.ts`):
  - `schematicDraftPath(draft)`: a polyline from the draft points.
  - `schematicWireHandles(element, selected)`: one handle per point of a
    selected schematic wire in page coordinates, each `{index, at, label}`
    with label "Wire start", "Wire end" or "Wire bend N of M".
  - `schematicHandleKey(key, shiftKey)`: `ArrowLeft/Right/Up/Down` -> one
    lattice pitch `{dx, dy}`, anything else null.
  - `schematicFocusAfterNudge(result: number | null, current: number)`:
    the returned index on success, `current` on rejection (null).
  - `schematicNoticeLabel(notice, draft)`: null when the notice is null,
    else `{text, at}` with `at` the last draft point, or null for an empty
    draft.
- `SchematicOverlay.tsx`: draws the draft polyline (from the `wireDraft`
  prop), a ring on the last draft point, and the handles. Each handle is an
  SVG element with `tabindex="0"`, `role="button"` and `aria-label` set to
  the handle label, and a visible focus ring (`:focus-visible` stroke
  `var(--nodetto-accent)`). `onPointerDown` calls
  `props.startWirePoint(id, index, event)`. `onKeyDown` maps the key with
  `schematicHandleKey`; on a hit it calls `event.preventDefault()` and
  `props.nudgeWirePoint(id, index, dx, dy)` (plan 46, returns the moved
  point's resulting index or null). After the handles re-render, it focuses
  the handle at `schematicFocusAfterNudge(result, index)`. It never reuses
  the old index after a successful edit, because elbows inserted before
  the point would shift it. The notice renders with `role="status"`
  and `aria-live="polite"`, text `var(--nodetto-ink)` on
  `var(--nodetto-surface)`. Existing tokens only, no colour literals.
- `Canvas.tsx`: an `isSchematicPage` memo and
  `<SchematicOverlay wireDraft={interaction.wireDraft}
  notice={interaction.schematicWireNotice}
  startWirePoint={interaction.startBreadboardWirePoint}
  nudgeWirePoint={interaction.nudgeSchematicWirePoint} ... />` next to the
  breadboard overlay. The canvas `onKeyDown` already skips events with
  `defaultPrevented`, so arrow keys on a handle do not nudge the selection.

## Tests (schematic-overlay.test.ts)

- draft path for (0,0),(30,0),(30,20) is that polyline; an empty draft gives
  no path; the ring is at the last point.
- notice: exact crossing text at the last draft point; null notice -> null;
  null draft with a notice -> `at` null, text kept.
- handles: a selected 3-point wire gives 3 handles labelled "Wire start",
  "Wire bend 2 of 3", "Wire end"; an unselected wire gives none.
- keys: each arrow maps to one pitch in its direction; Tab, Enter and
  letters map to null.
- focus helper: `schematicFocusAfterNudge(2, 1)` is 2, and
  `schematicFocusAfterNudge(null, 1)` is 1.
- two-press keyboard regression on a real editor, following the handle key
  path (`schematicHandleKey("ArrowDown")`, `interaction.nudgeSchematicWirePoint`,
  `schematicFocusAfterNudge`). Start with the bend (index 1) of
  [(0,0),(30,0),(30,20)] focused. The first press gives
  [(0,0),(30,0),(30,10),(30,20)] with focus index 2, and
  `schematicWireHandles` shows (30,10) at index 2. The second press acts on
  index 2 and gives [(0,0),(30,0),(30,20)] with focus index 2 (merged end).
  The untouched end (0,0) stays fixed. Two undos restore the original.

## Verification

- `bun test packages/ui-solid/src/schematic-overlay.test.ts packages/ui-solid/src/schematic-wire-edit.test.ts packages/ui-solid/src/schematic-wire.test.ts packages/ui-solid/src/breadboard-interaction.test.ts` exits 0.
- `bunx biome check packages/ui-solid/src/SchematicOverlay.tsx packages/ui-solid/src/schematic-overlay.ts packages/ui-solid/src/schematic-overlay.test.ts packages/ui-solid/src/Canvas.tsx` exits 0.
- Integration-step manual check, recorded in the progress log: in the
  desktop editor, in the light and the dark theme, Tab reaches a bend and an
  end handle with a visible focus ring. Two successive ArrowDown presses on
  the bend keep moving the same point, as in the regression above, and two
  Cmd/Ctrl+Z restore the points.

## Done criteria

All bullets pass; no file outside writePaths edited.
