// Flip horizontal / vertical for geometric shapes.
//
// A flip mirrors the drawn outline about the shape's own centre, so the box,
// the label and any connections stay where they are. Each selected shape
// flips in place in one undo step; a cleared flip is removed from the visual
// rather than stored as `false`, keeping files minimal.

import type { Element, ElementId } from "@nodetto/ir";
import type { Command } from "./commands.ts";
import type { Editor } from "./editor.ts";

export type FlipAxis = "horizontal" | "vertical";

/** Only shapes whose outline the renderers can mirror are flippable. */
export function canFlipElement(element: Element | undefined): boolean {
  return element?.type === "shape.geo";
}

function flipField(axis: FlipAxis): "flipX" | "flipY" {
  return axis === "horizontal" ? "flipX" : "flipY";
}

/** Commands that set `axis` on each flippable element to `value`. */
export function flipCommands(
  elements: readonly Element[],
  axis: FlipAxis,
  value: (element: Element) => boolean,
): Command[] {
  const field = flipField(axis);
  return elements.filter(canFlipElement).flatMap((element): Command[] => {
    const next = value(element);
    if ((element.visual[field] === true) === next) return [];
    const { [field]: _old, ...rest } = element.visual;
    return [
      {
        type: "replaceVisual",
        id: element.id,
        visual: next ? { ...rest, [field]: true } : rest,
      },
    ];
  });
}

/** Toggle `axis` on every flippable element in `ids`; true when any changed. */
export function flipElements(
  editor: Editor,
  ids: Iterable<ElementId>,
  axis: FlipAxis,
): boolean {
  const field = flipField(axis);
  const context = editor.createShapeContext();
  const elements = [...ids]
    .map((id) => editor.store.get(id))
    .filter(
      (element): element is Element =>
        element !== undefined && !context.isLocked?.(element.id),
    );
  const commands = flipCommands(
    elements,
    axis,
    (element) => element.visual[field] !== true,
  );
  if (commands.length === 0) return false;
  editor.apply(commands);
  return true;
}

/** Whether a flip of `ids` would change anything. */
export function canFlipSelection(
  editor: Editor,
  ids: Iterable<ElementId>,
): boolean {
  const context = editor.createShapeContext();
  return [...ids].some(
    (id) => canFlipElement(editor.store.get(id)) && !context.isLocked?.(id),
  );
}
