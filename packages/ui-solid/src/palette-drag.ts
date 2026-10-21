import type { Box, Editor, Vec } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { creationFor, type ToolKind } from "./tools.ts";

/** A transient render model; never allocate document IDs, indices or history. */
export function paletteDragPreview(
  editor: Editor,
  tool: ToolKind,
): { element: Element; box: Box } | null {
  const creation = creationFor(tool);
  if (!creation) return null;
  const util = editor.getShapeUtil(creation.type);
  const semantic = creation.semantic ?? util.defaultSemantic();
  const compactState =
    creation.type === "state.node" &&
    (semantic as { kind?: string }).kind !== "state";
  const element: Element = {
    id: "palette-drag-preview",
    page: editor.currentPageId,
    type: creation.type,
    index: "a0",
    semantic,
    visual: {
      ...util.defaultVisual(),
      ...(compactState ? { width: 32, height: 32 } : {}),
      ...creation.visual,
      x: 0,
      y: 0,
    },
  };
  const bounds = util.getBounds(element, editor.createShapeContext());
  if (!bounds) return null;
  return {
    element,
    box: { x: 0, y: 0, width: bounds.width, height: bounds.height },
  };
}

/** A canvas rectangle alone is insufficient when a menu or editor covers it. */
export function paletteDropInsideCanvas(
  bounds: { left: number; top: number; right: number; bottom: number },
  point: Vec,
  uncovered: boolean,
): boolean {
  return (
    uncovered &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= bounds.left &&
    point.x < bounds.right &&
    point.y >= bounds.top &&
    point.y < bounds.bottom
  );
}
