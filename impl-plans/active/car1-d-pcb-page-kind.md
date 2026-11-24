# car1-d-pcb-page-kind: capture input and board choices respect the PCB page kind (F2)

- planId: car1-d-pcb-page-kind. Wave 1. dependsOn: none. Gate: none. The
  commit-time guard is plan d2, gated on Q1.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F2 and 6.1;
  `design-docs/specs/design-cad3d.md` 19 F2.
- Progress log: `impl-plans/progress/car1-d-pcb-page-kind.md`.

## Intent

When a referenced board's page is no longer a PCB page, the CLI (and MCP,
which runs the CLI capture command) and the desktop capture report
`cad.reference.missing`, as `cad check` does. The board choices omit
the board. Undo restores both.

## Non-goals

- Do not edit `board-picker.tsx` (Q1, plan d2), `construction.ts`,
  `report.ts` (plan e) or `backend.ts` (plan f).
- No change to `captureCadImage` other than its element input.

## Changes

1. `apps/cli/src/capture-command.ts` (the CAD branch near `:242`): pass
   `collectCadInput(document, page.id, 0).elements` (import from
   `@nodetto/core`, as `apps/cli/src/cad-command.ts:54` does) to
   `renderCadCapture`, instead of `document.elements`. Leave
   `io.decodeMesh` untouched.
2. `apps/desktop/src/shell/export-handlers.ts` `captureCadImage`: pass
   `collectCadInput(source.editor.getSnapshot(), page.id, source.editor.revision).elements`
   to `prepareCadCapture`, imitating `exportStl` in the same file.
3. `packages/ui-solid/src/cad/pcb-insert.ts`:
   - `pcbBoardChoices` lists only boards whose page has `kind === "pcb"`.
   - Add `export function isPcbBoardChoice(document, boardId): boolean`,
     using the same rule.
   - `pcbBoardOptions` is unchanged.

## Pitfalls

- `collectCadInput` returns no elements when the page is not `cad3d`. Both
  call sites already require `cad3d`; keep that order.
- Do not filter inside `visitCadConstruction`. The missing reference must
  come from `scanCadPage` with the same code as `cad check`.

## Tests (each fails before)

- `packages/ui-solid/src/cad/pcb-insert.test.ts`: a board on a page
  converted with `editor.setPageKind(pageId, "freeform")` is absent from
  the choices, and `isPcbBoardChoice` is false. After `editor.undo()`,
  both report the board again.
- `apps/cli/src/capture-command.test.ts` (fake backend): a CAD page with
  a PCB reference whose board page is freeform gives the error line
  `cad.reference.missing` for the reference and no reference body. The
  same document with a PCB page draws the reference body.
- `apps/desktop/src/shell/export-handlers.test.ts`: the same document
  through `captureCadImage` gives a model error `cad.reference.missing`
  and no reference body in the prepared scene. After undo of the page
  kind, the reference body is back.

## Verification

1. `biome check apps/cli/src/capture-command.ts apps/desktop/src/shell/export-handlers.ts packages/ui-solid/src/cad/pcb-insert.ts packages/ui-solid/src/cad/pcb-insert.test.ts apps/cli/src/capture-command.test.ts apps/desktop/src/shell/export-handlers.test.ts && bun test packages/ui-solid/src/cad/pcb-insert.test.ts apps/cli/src/capture-command.test.ts apps/desktop/src/shell/export-handlers.test.ts`
   must exit 0.
2. `bun run typecheck && bun test apps/cli/src/mcp.test.ts packages/core/src/capture/cad-request.test.ts`
   must exit 0.

## Done when

- The three tests pass and existing picker and capture tests are
  unchanged.
- The progress log records hashes and exit codes.

## Implementation status

- Source and focused regressions implemented; scoped checks pass.
- Both required gates pass on the shared tree; baseline regression controls fail as expected. Formal review and integration are downstream.
