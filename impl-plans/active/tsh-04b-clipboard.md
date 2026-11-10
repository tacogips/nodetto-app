# tsh-04b-clipboard

- planId: tsh-04b-clipboard
- planPath: impl-plans/active/tsh-04b-clipboard.md
- progressPath: impl-plans/progress/tsh-04b-clipboard.md
- wave: 2
- dependsOn: tsh-01a-ir, tsh-01c-edits, tsh-01d-values
- Design: `design-docs/specs/design-table-sheet.md` section 6 (Clipboard) and section 12 (clipboard preservation).
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `packages/ui-solid/src/table-sheet/clipboard.ts` (new)
  - `packages/ui-solid/src/table-sheet/clipboard.test.ts` (new)
  - `impl-plans/progress/tsh-04b-clipboard.md`
  - `tmp/tsh-s780/tsh-04b-clipboard`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan adds TSV copy, cut and paste for a cell range. The text moves
through an injected port, so tests need no DOM clipboard. tsh-08 binds the
port to `navigator.clipboard` and routes Cmd/Ctrl+C/X/V to these functions
while a cell is active. These functions take explicit targets and never
import the selection module (tsh-04a).

## Non-goals

- No key handling and no selection state.
- No element-level copy/paste changes.

## Contracts to export

```ts
export interface TableClipboardPort { writeText(text: string): void | Promise<void>; readText(): Promise<string> }
export interface TableRangeTarget { readonly elementId: ElementId; readonly range: TableSheetRange }
export interface TablePasteTarget { readonly elementId: ElementId; readonly row: number; readonly column: number }
export function copyTableRange(editor: Editor, target: TableRangeTarget, port: TableClipboardPort): Promise<boolean>;
export function cutTableRange(editor: Editor, target: TableRangeTarget, port: TableClipboardPort): Promise<boolean>;
export function pasteIntoTable(editor: Editor, target: TablePasteTarget, port: TableClipboardPort,
  ids?: IdSource): Promise<{ result: TableSheetEditResult; range: TableSheetRange | null } | null>;
```

## Key points

- Copy:
  - Write `serializeTsv(clipboardGrid(semantic, range))`. Read the semantic
    fresh with `editor.store.get`.
  - Use STORED values, never `tableSheetLayout` display strings.
  - Return false when the element is missing or not a `table.sheet`.
- Cut:
  - Write the clipboard first and await it. Only then re-read the
    semantic and apply one `clearRange` through `applyTableSheetEdit`.
    That is exactly one history entry.
  - If `writeText` rejects, apply nothing and return false.
- Paste:
  - Call `await port.readText()`. A rejection returns null without
    throwing.
  - Parse with `parseTsv`, re-read the semantic, and call
    `pasteGrid(s, {row, column}, grid, ids ?? newElementId)` once through
    `applyTableSheetEdit`.
  - Return the result. On `ok:true`, `range` covers the pasted grid in the
    new semantic. On `ok:false`, `range` is null and nothing changed.
  - An empty clipboard returns null.

## Tests (`clipboard.test.ts`; a real `Editor` from `@nodetto/core`; a fake port that stores text)

Create the table with `editor.createElement("table.sheet", { semantic, visual: {x:0,y:0} })`.

- Copy a range holding `"alpha\nbeta"`, `"tab\there"`, `say "hi"` and
  `"line1\r\nline2"`, then paste into another range -> the stored values
  are exactly equal.
- Cut those values -> range cleared with exactly one history entry; paste
  elsewhere -> exact values; one undo of the cut restores the original
  range.
- Typed values copy as `42`, `TRUE`, `Doing` and `2024-02-29`, and paste
  back into same-typed columns unchanged.
- A paste that would exceed 100 columns -> semantic unchanged, result
  `table.limit`.
- A paste past the bottom grows rows, and `range` covers it.
- A rejecting `readText` -> null and no change.
- A rejecting `writeText` on cut -> false and no change.

## Verification (exits 0 and shows at least 1 test with 0 failures; log under `tmp/tsh-s780/tsh-04b-clipboard/final/`)

1. `bun test ./packages/ui-solid/src/table-sheet/clipboard.test.ts` -> `clipboard.log`

Static checks (tsh-00): `bunx biome check packages/ui-solid/src/table-sheet/clipboard.ts packages/ui-solid/src/table-sheet/clipboard.test.ts --diagnostic-level=warn`,
then `bun run typecheck`.

## Done criteria

- The contracts are exported, and verification 1 exited 0 with at least 7
  tests.
- The progress log names the clipboard preservation test and the
  single-undo cut test.
