# M21 cad3d-21-pcb-ui

- dependsOn: M14 (`cad.pcb`, outline, evaluation), M10 (`CadIds`,
  `authoring.ts`); runs after M20 (shared `authoring.ts` is not edited by
  M20, shared `CadViewport.tsx` is)
- Design: sections 5, 8
- writePaths: `packages/core/src/cad/authoring.ts` and its test,
  `packages/core/src/layer-name.ts`, `packages/core/src/tools.ts`,
  `packages/ui-solid/src/workspaces.ts`,
  `packages/ui-solid/src/shape-palette.ts`,
  `packages/ui-solid/src/cad/pcb-insert.ts` (new) and its test,
  `packages/ui-solid/src/inspector/CadSection.tsx`,
  `packages/ui-solid/src/inspector/cad-edits.ts` and its test,
  `packages/ui-solid/src/cad/CadViewport.tsx`

## Contract

```ts
// packages/core/src/cad/authoring.ts
export function pcbReferenceCommands(pageId: PageId, boardId: ElementId, name: string, ids: CadIds, after?: string): Command[];
// packages/ui-solid/src/cad/pcb-insert.ts (pure)
export interface PcbBoardChoice { readonly boardId: ElementId; readonly pageName: string }
export function pcbBoardChoices(document: { pages: readonly Page[]; elements: readonly Element[] }): readonly PcbBoardChoice[];
// packages/ui-solid/src/inspector/cad-edits.ts
export function setCadBoard(element: Element, boardId: ElementId): Command | { error: string };
```

## Behavior

- Tool `cad:pcb` ("PCB board") in `tools.ts` (`creationFor` returns
  `{ type: "cad.pcb" }`) and in the `cad3d` workspace and palette only.
- Activating the tool: `pcbBoardChoices` lists every `pcb.board` element
  with its page name, sorted by page order; with one choice the reference
  is inserted directly, with several a popover built from the existing
  menu components asks; with none the status strip says that the document
  has no PCB page. Insertion applies `pcbReferenceCommands` (one undo
  step) and selects the new feature.
- `CadSection` shows a board select (from `pcbBoardChoices`) and the
  thickness field for a `cad.pcb`; edits go through `setCadBoard` and
  `setCadNumber`.
- `layer-name.ts`: the `name` of a `cad.pcb`, default "PCB board".
- The viewport's store subscription (M19) already reacts to collected
  foreign elements; verify with a test that editing an `Edge.Cuts` graphic
  on the PCB page triggers one more `evaluate` on the CAD page.

## Tests

- `authoring.test.ts`: `pcbReferenceCommands` on a CAD page validates and
  `validateDocument` is clean (the board stays on its PCB page); on a
  freeform page it fails with `page.contentKind`.
- `pcb-insert.test.ts`: zero, one and two boards; hidden pages still
  listed; order by page order.
- `cad-edits.test.ts`: `setCadBoard` gives one `updateSemantic`; an
  unchanged board gives no command; thickness "0" is an error.
- `viewport.test.tsx` (pre-authorised extension): with fakes, the tool
  with one board applies one command batch; a change to a collected
  graphic calls `evaluate` again; a change to an uncollected element on
  the PCB page does not.
- `cad-palette.test.ts` and `workspaces.test.ts` pass with the new tool
  (the tool appears in no other workspace).

## Acceptance criteria

- From the UI, a user with a PCB page can insert the board as a reference
  body on a CAD page and see it update after a board outline edit.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad/authoring.test.ts packages/ui-solid/src/cad packages/ui-solid/src/inspector/cad-edits.test.ts packages/ui-solid/src/cad-palette.test.ts packages/ui-solid/src/workspaces.test.ts'`
2. `sh -c 'mkdir -p tmp/cad3d/m21; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m21/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m21/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/ui-solid/src/cad/pcb-insert.test.ts'`
3. `sh -c 'bunx biome check packages/core/src/cad packages/ui-solid/src/cad packages/ui-solid/src/inspector && bun test packages/ui-solid/src/cad/pcb-insert.test.ts'`
