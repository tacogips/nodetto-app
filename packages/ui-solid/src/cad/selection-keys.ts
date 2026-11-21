import type { Editor } from "@nodetto/core";
import { isComposing } from "../NumberInput.tsx";

export function handleCadSelectionKey(
  editor: Editor,
  event: KeyboardEvent,
): void {
  if (isComposing(event) || event.ctrlKey || event.metaKey || event.altKey)
    return;
  if (event.key === "Escape") {
    editor.selection.clear();
  } else if (event.key === "Delete" || event.key === "Backspace") {
    if (editor.readOnly || editor.selection.size === 0) return;
    editor.deleteSelection();
  } else {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}
