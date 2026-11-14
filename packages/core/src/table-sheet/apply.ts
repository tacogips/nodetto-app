import type { ElementId, TableSheetSemantic } from "@nodetto/ir";
import type { Editor } from "../editor.ts";
import type { TableSheetEditResult } from "./types.ts";

export function applyTableSheetEdit(
  editor: Editor,
  id: ElementId,
  edit: (s: TableSheetSemantic) => TableSheetEditResult,
): TableSheetEditResult {
  const element = editor.store.get(id);
  if (!element || element.type !== "table.sheet")
    return { ok: false, code: "table.unknownRow", message: "Table not found" };
  const current = element.semantic as TableSheetSemantic;
  const result = edit(current);
  if (result.ok && result.semantic !== current)
    editor.apply([{ type: "updateSemantic", id, semantic: result.semantic }]);
  return result;
}
