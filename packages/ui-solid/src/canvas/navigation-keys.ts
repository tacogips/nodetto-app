// Canvas navigation keys that keep working while focus sits elsewhere in
// the editor, and the window-level key-up and blur the interaction needs.

import { type Interaction, isEditableTarget } from "../interaction.ts";

/**
 * Listen for H, V and Space anywhere under the editor root (or the canvas
 * when there is none) and for window key-up and blur. Returns the cleanup.
 */
export function listenForNavigationKeys(
  element: HTMLElement,
  interaction: Interaction,
): () => void {
  // Navigation keys also work after focusing a toolbar or layer control.
  // Text entry, modal/menu navigation and native Space activation keep ownership.
  const shortcutRoot =
    element.closest<HTMLElement>("[data-nodetto-editor]") ?? element;
  const navigate = (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      isEditableTarget(event.target)
    )
      return;
    const target =
      event.target instanceof globalThis.Element ? event.target : null;
    if (
      target?.closest(
        'dialog, [role="dialog"], [role="menu"], [role="listbox"]',
      )
    )
      return;
    const key = event.key.toLowerCase();
    const space = key === " " || key === "spacebar" || event.code === "Space";
    if (key !== "h" && key !== "v" && !space) return;
    if (
      space &&
      target?.closest('button, a[href], summary, [role="button"], [role="tab"]')
    )
      return;
    interaction.onKeyDown(event);
    if (event.defaultPrevented) element.focus();
  };
  shortcutRoot.addEventListener("keydown", navigate);
  window.addEventListener("keyup", interaction.onKeyUp);
  window.addEventListener("blur", interaction.onBlur);
  return () => {
    shortcutRoot.removeEventListener("keydown", navigate);
    window.removeEventListener("keyup", interaction.onKeyUp);
    window.removeEventListener("blur", interaction.onBlur);
  };
}
