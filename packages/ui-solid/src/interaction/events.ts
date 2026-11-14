// DOM event helpers shared by the pointer and keyboard handlers: where an
// event came from, and which key a chord was pressed with.

/** Pointer travel below this many screen pixels still counts as a click. */
export const CLICK_SLOP_PX = 3;

/** Wheel delta in "lines" is converted to pixels with this factor. */
const LINE_HEIGHT = 16;

const EDITABLE_TAGS: ReadonlySet<string> = new Set([
  "INPUT",
  "TEXTAREA",
  "SELECT",
]);

/** Class of the page-space slot the inline text editor mounts in. */
export const SLOT_LAYER_CLASS = "nodetto-slot-layer";

/** Whether this runs on macOS or iOS, where Option composes characters. */
export function isApplePlatform(): boolean {
  const nav = (globalThis as { navigator?: { platform?: string } }).navigator;
  return /Mac|iPhone|iPad|iPod/.test(nav?.platform ?? "");
}

/**
 * The letter a modifier chord was pressed with. macOS turns Option+letter
 * into another character (Option+L is "¬", Option+G is "©"), so there, with
 * Option held, the physical key decides. Elsewhere Ctrl+Alt is AltGr on
 * many layouts (Polish AltGr+A is "ą"): that is text input, so the layout's
 * character is kept and never collapses onto a shortcut letter.
 */
export function shortcutKey(
  event: Pick<KeyboardEvent, "key" | "code" | "altKey"> & {
    readonly getModifierState?: (key: string) => boolean;
  },
  apple: boolean = isApplePlatform(),
): string {
  if (
    apple &&
    event.altKey &&
    !event.getModifierState?.("AltGraph") &&
    /^Key[A-Z]$/.test(event.code)
  )
    return event.code.slice(3).toLowerCase();
  return event.key.toLowerCase();
}

export function wheelPixels(delta: number, mode: number): number {
  return mode === 0 ? delta : delta * LINE_HEIGHT;
}

/**
 * True for a key event the canvas must leave alone because something that
 * takes typing owns it: an input, textarea, select or contenteditable. The
 * inline text editor lives inside the canvas, so its keys bubble up here.
 * A missing target (headless tests) is not editable.
 */
export function isEditableTarget(
  target: EventTarget | null | undefined,
): boolean {
  if (!target) {
    return false;
  }
  const node = target as { tagName?: unknown; isContentEditable?: unknown };
  if (typeof node.tagName === "string" && EDITABLE_TAGS.has(node.tagName)) {
    return true;
  }
  return node.isContentEditable === true;
}

/** True when the event started inside the page-space slot layer. */
export function insideSlot(target: EventTarget | null | undefined): boolean {
  const node = target as { closest?: unknown } | null | undefined;
  if (!node || typeof node.closest !== "function") {
    return false;
  }
  return (
    (node.closest as (selector: string) => unknown)(`.${SLOT_LAYER_CLASS}`) !==
    null
  );
}
