// The nodetto:// link the desktop app opens: a local file, optionally at one
// page. It uses no Node APIs, so the embedded native engine shares it.

/** `page` is a full or short page ID; the app resolves it after loading. */
export function desktopOpenLink(absolutePath: string, page: string): string {
  return `nodetto://open?path=${encodeURIComponent(absolutePath)}&page=${encodeURIComponent(page)}`;
}
