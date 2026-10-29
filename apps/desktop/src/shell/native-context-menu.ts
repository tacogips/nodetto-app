// The webview's own context menu offers Reload, which restarts the frontend
// and replaces the open document with an empty untitled one. The app's chrome
// has no use for that menu; text fields and selected text keep it for copy
// and paste. The canvas and app menus already show their own.

const TEXT_TARGET =
  'input, textarea, [contenteditable]:not([contenteditable="false"])';

interface ContextMenuTarget {
  closest(selector: string): unknown;
}

/** True when the native menu is useful here: editable text or a selection. */
export function keepsNativeContextMenu(
  target: unknown,
  selectedText: string,
): boolean {
  if (selectedText.trim() !== "") return true;
  const element = target as Partial<ContextMenuTarget> | null;
  return typeof element?.closest === "function"
    ? element.closest(TEXT_TARGET) !== null
    : false;
}

export function installNativeContextMenuGuard(host: Window): () => void {
  const onContextMenu = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    const selected = host.getSelection()?.toString() ?? "";
    if (!keepsNativeContextMenu(event.target, selected)) event.preventDefault();
  };
  host.addEventListener("contextmenu", onContextMenu);
  return () => host.removeEventListener("contextmenu", onContextMenu);
}
