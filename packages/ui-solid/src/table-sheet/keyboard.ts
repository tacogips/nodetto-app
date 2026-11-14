import { applyTableSheetEdit, clearRange, type Editor } from "@nodetto/core";
import type { TableSheetSelection } from "./selection.ts";

export interface TableSheetKeyContext {
  editor: Editor;
  selection: TableSheetSelection;
}

export function handleTableSheetKey(
  event: KeyboardEvent,
  ctx: TableSheetKeyContext,
): boolean {
  const { editor, selection } = ctx;
  const state = selection.state();
  if (
    !state ||
    !editor.selection.has(state.elementId) ||
    state.editing ||
    event.isComposing
  )
    return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  switch (event.key) {
    case "ArrowUp":
      selection.move(editor, -1, 0, { extend: event.shiftKey });
      break;
    case "ArrowDown":
      selection.move(editor, 1, 0, { extend: event.shiftKey });
      break;
    case "ArrowLeft":
      selection.move(editor, 0, -1, { extend: event.shiftKey });
      break;
    case "ArrowRight":
      selection.move(editor, 0, 1, { extend: event.shiftKey });
      break;
    case "Tab":
      selection.move(editor, 0, event.shiftKey ? -1 : 1, { wrap: true });
      break;
    case "Enter":
    case "F2":
      selection.startEditing();
      break;
    case "Delete":
    case "Backspace": {
      const range = selection.range(editor);
      if (range)
        applyTableSheetEdit(editor, state.elementId, (semantic) =>
          clearRange(semantic, range),
        );
      break;
    }
    case "Escape":
      selection.clear();
      break;
    default:
      if (event.key.length !== 1) return false;
      selection.startEditing(event.key);
  }
  event.preventDefault();
  return true;
}
