/** Keep unhandled drops from navigating the desktop webview. */
export function installFileDropGuard(host: Window): () => void {
  const rejectUnhandledDrop = (event: DragEvent): void => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (event.type === "dragover" && event.dataTransfer)
      event.dataTransfer.dropEffect = "none";
  };

  // Listen after the canvas and Solid's delegated document handlers.
  host.addEventListener("dragover", rejectUnhandledDrop);
  host.addEventListener("drop", rejectUnhandledDrop);
  return () => {
    host.removeEventListener("dragover", rejectUnhandledDrop);
    host.removeEventListener("drop", rejectUnhandledDrop);
  };
}
