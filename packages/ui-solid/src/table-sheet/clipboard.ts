import {
  applyTableSheetEdit,
  clearRange,
  clipboardGrid,
  newElementId,
  parseTsv,
  pasteGrid,
  serializeTsv,
  type Editor,
  type IdSource,
  type TableSheetEditResult,
  type TableSheetRange,
} from "@nodetto/core";
import type { ElementId, TableSheetSemantic } from "@nodetto/ir";

export interface TableClipboardPort {
  writeText(text: string): void | Promise<void>;
  readText(): Promise<string>;
}
export interface TableRangeTarget {
  readonly elementId: ElementId;
  readonly range: TableSheetRange;
}
export interface TablePasteTarget {
  readonly elementId: ElementId;
  readonly row: number;
  readonly column: number;
}

function readTable(editor: Editor, id: ElementId): TableSheetSemantic | null {
  const element = editor.store.get(id);
  return element?.type === "table.sheet"
    ? (element.semantic as TableSheetSemantic)
    : null;
}
export async function copyTableRange(
  editor: Editor,
  target: TableRangeTarget,
  port: TableClipboardPort,
): Promise<boolean> {
  const semantic = readTable(editor, target.elementId);
  if (!semantic) return false;
  try {
    await port.writeText(serializeTsv(clipboardGrid(semantic, target.range)));
    return true;
  } catch {
    return false;
  }
}
export async function cutTableRange(
  editor: Editor,
  target: TableRangeTarget,
  port: TableClipboardPort,
): Promise<boolean> {
  if (!(await copyTableRange(editor, target, port))) return false;
  if (!readTable(editor, target.elementId)) return false;
  return applyTableSheetEdit(editor, target.elementId, (s) =>
    clearRange(s, target.range),
  ).ok;
}
export async function pasteIntoTable(
  editor: Editor,
  target: TablePasteTarget,
  port: TableClipboardPort,
  ids: IdSource = newElementId,
): Promise<{
  result: TableSheetEditResult;
  range: TableSheetRange | null;
} | null> {
  let text: string;
  try {
    text = await port.readText();
  } catch {
    return null;
  }
  if (!text) return null;
  const grid = parseTsv(text);
  const semantic = readTable(editor, target.elementId);
  if (!semantic) return null;
  const top = Math.max(
    0,
    Math.min(target.row, Math.max(0, semantic.rows.length - 1)),
  );
  const left = Math.max(
    0,
    Math.min(target.column, Math.max(0, semantic.columns.length - 1)),
  );
  const result = applyTableSheetEdit(editor, target.elementId, (s) =>
    pasteGrid(s, { row: target.row, column: target.column }, grid, ids),
  );
  const range = result.ok
    ? {
        top,
        left,
        bottom: top + grid.length - 1,
        right: left + Math.max(...grid.map((row) => row.length)) - 1,
      }
    : null;
  return { result, range };
}
