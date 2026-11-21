/** Keep an unhandled file drop from navigating the desktop webview. */
export function installFileDropGuard(host: Window): () => void {
  const rejectUnhandledFile = (event: DragEvent): void => {
    const transfer = event.dataTransfer;
    if (event.defaultPrevented || !transfer?.types.includes("Files")) return;
    event.preventDefault();
    if (event.type === "dragover") transfer.dropEffect = "none";
  };

  // Listen after the canvas and Solid's delegated document handlers.
  host.addEventListener("dragover", rejectUnhandledFile);
  host.addEventListener("drop", rejectUnhandledFile);
  return () => {
    host.removeEventListener("dragover", rejectUnhandledFile);
    host.removeEventListener("drop", rejectUnhandledFile);
  };
}
