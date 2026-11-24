# car2-p-picker-guard: commit-time PCB board eligibility (R2-2)

- planId: car2-p-picker-guard
- Wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-2.
- Progress log: `impl-plans/progress/car2-p-picker-guard.md`

## Intent

The board picker must not insert a reference to a board whose page stopped
being a PCB page after the menu opened.

## Non-goals

- Do not change `pcb-insert.ts`, `authoring.ts`, `engine.ts`, the picker
  layout or its keyboard handling.

## Changes (`packages/ui-solid/src/cad/board-picker.tsx`, `insert` at `:79-102`)

- Replace `editor.store.get(boardId)?.type === "pcb.board"` with
  `isPcbBoardChoice(editor.getSnapshot(), boardId)`, imported from
  `./pcb-insert.ts`. Evaluate it immediately before
  `pcbReferenceCommands` is built.
- When `canInsert(version)` holds but the choice is stale:
  - do not call `editor.apply`;
  - do not change the selection;
  - call `setNotice("Could not insert the PCB board.")`;
  - then `close()`.
- The notice must survive the reactive batch in which the page was
  converted. The clearing effect on `[options.selection,
  options.revision]` (`:135-139`) must not erase a notice set in the same
  batch. Record the `options.revision()` value at the time the notice is
  set (for example, keep the notice as `{ text, revision }`), and clear
  only when the revision differs from the recorded one or the selection
  changes. Keep the `notice` accessor's public type unchanged
  (`string | undefined`).

## Pitfalls

- A valid choice must still insert exactly as today, including selecting
  the created element.
- The single-board shortcut (`:121-122`) goes through the same `insert`,
  so it is covered.

## Tests (`packages/ui-solid/src/test-dom/cad-sketch.dom.tsx`, run by `packages/ui-solid/src/cad/viewport.test.tsx`)

Imitate the existing picker case at `:629-636`.

- Stale option. Open the picker with two boards. In one `batch`, convert
  the first board's source page to freeform and click its option. Then
  assert:
  - the history length is unchanged;
  - there is no `cad.pcb` element;
  - the selection is unchanged;
  - the notice text is `Could not insert the PCB board.`;
  - the picker menu is closed.

  Fails before: the reference is inserted and the notice is null.
- Restored choice. Undo the conversion, reopen the picker and click the
  restored option. Exactly one `cad.pcb` element and one new history entry
  are added.

## Verification

- `bun test packages/ui-solid/src/cad/viewport.test.tsx packages/ui-solid/src/cad/pcb-insert.test.ts`
  must exit 0.
- `bunx biome check --diagnostic-level=warn packages/ui-solid/src/cad/board-picker.tsx packages/ui-solid/src/test-dom/cad-sketch.dom.tsx`
  must exit 0.

## Done when

- The tests pass, and the existing picker cases pass unedited.
- The progress log reads `done`.

Implementation status: done; formal review and integration are pending.
