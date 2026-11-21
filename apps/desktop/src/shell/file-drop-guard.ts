function isTextDropTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  const field = element?.closest("input, textarea");
  if (field)
    return !field.matches('input[type="file" i], :disabled, [readonly]');

  // The nearest valid contenteditable value wins. Missing and invalid values inherit.
  const editable = element?.closest(
    '[contenteditable=""], [contenteditable="true" i], [contenteditable="plaintext-only" i], [contenteditable="false" i]',
  );
  return !!editable && !editable.matches('[contenteditable="false" i]');
}

/** Keep unhandled drops from navigating the desktop webview. */
export function installFileDropGuard(host: Window): () => void {
  const rejectUnhandledDrop = (event: DragEvent): void => {
    if (event.defaultPrevented) return;
    const transfer = event.dataTransfer;
    if (
      transfer &&
      !transfer.types.includes("Files") &&
      isTextDropTarget(event.target)
    )
      return;

    event.preventDefault();
    if (event.type === "dragover" && transfer) transfer.dropEffect = "none";
  };

  // Listen after the canvas and Solid's delegated document handlers.
  host.addEventListener("dragover", rejectUnhandledDrop);
  host.addEventListener("drop", rejectUnhandledDrop);
  return () => {
    host.removeEventListener("dragover", rejectUnhandledDrop);
    host.removeEventListener("drop", rejectUnhandledDrop);
  };
}
