// The viewer footer holds the page tabs and the zoom controls on one row.
// Below this width the full zoom controls would push the tabs onto a second
// row, so the controls fold into their menu button instead.

/** Footer widths (CSS px) below this fold the zoom controls into a menu. */
export const COMPACT_FOOTER_WIDTH = 560;

export function isCompactFooter(width: number): boolean {
  // A footer that is not laid out yet (width 0) keeps the full controls.
  return width > 0 && width < COMPACT_FOOTER_WIDTH;
}

/**
 * Report whether `footer` is compact now and whenever its width changes.
 * Returns the function that stops watching.
 */
export function watchCompactFooter(
  footer: HTMLElement,
  report: (compact: boolean) => void,
): () => void {
  report(isCompactFooter(footer.getBoundingClientRect().width));
  if (typeof ResizeObserver === "undefined") return () => {};
  const observer = new ResizeObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (entry) report(isCompactFooter(entry.contentRect.width));
  });
  observer.observe(footer);
  return () => observer.disconnect();
}
