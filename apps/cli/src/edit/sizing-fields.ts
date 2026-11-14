import { frameParents } from "@nodetto/core";
import { isPlainObject, type ElementId, type FrameSemantic } from "@nodetto/ir";
import type { Batch } from "./batch.ts";
import { OperationError, type JsonObject } from "./operation-input.ts";

export function applySizingFields(
  batch: Batch,
  id: ElementId,
  operation: JsonObject,
  index: number,
): void {
  const sizing = operation["sizing"];
  const absolute = operation["absolute"];
  if (sizing === undefined && absolute === undefined) return;
  const element = batch.editor.store.get(id);
  if (!element) throw new OperationError(index, `No element ${id}`);
  if (absolute !== undefined && typeof absolute !== "boolean")
    throw new OperationError(index, '"absolute" must be boolean');
  if (
    sizing !== undefined &&
    (!isPlainObject(sizing) ||
      Object.keys(sizing).some((k) => k !== "width" && k !== "height"))
  )
    throw new OperationError(
      index,
      '"sizing" must contain only width and height',
    );
  batch.editor.setCurrentPage(element.page);
  const parentId = frameParents(
    batch.editor.store,
    element.page,
    batch.editor.createShapeContext(1),
  ).get(id);
  const parent = parentId ? batch.editor.store.get(parentId) : undefined;
  const parentLayout = parent
    ? (parent.semantic as FrameSemantic).layout
    : undefined;
  const visual = { ...element.visual };
  let semantic = element.semantic as FrameSemantic;
  if (absolute === true) visual.layoutPosition = "absolute";
  else if (absolute === false) visual.layoutPosition = undefined;
  if (isPlainObject(sizing))
    for (const axis of ["width", "height"] as const) {
      const value = sizing[axis];
      if (value === undefined) continue;
      if (value !== "fixed" && value !== "hug" && value !== "fill")
        throw new OperationError(index, `invalid ${axis} sizing`);
      const main =
        parentLayout &&
        (parentLayout.direction === "horizontal"
          ? axis === "width"
          : axis === "height");
      if (value === "fill") {
        if (!parentLayout)
          throw new OperationError(
            index,
            '"fill" needs a parent frame with layout',
          );
        if (main) visual.layoutGrow = 1;
        else if (parentLayout.align !== "stretch")
          throw new OperationError(
            index,
            'cross-axis "fill" needs the parent frame layout align "stretch"; set it with {"op":"layout","id":<parent>,"align":"stretch"}',
          );
      } else if (value === "hug") {
        if (element.type === "text.note")
          visual.textResize = axis === "width" ? "auto-width" : "auto-height";
        else if (element.type === "frame" && semantic.layout)
          semantic = {
            ...semantic,
            layout: {
              ...semantic.layout,
              [axis === "width" ? "widthSizing" : "heightSizing"]: "hug",
            },
          };
        else
          throw new OperationError(
            index,
            '"hug" needs text or a frame with layout',
          );
      } else {
        if (main) visual.layoutGrow = undefined;
        if (element.type === "text.note") visual.textResize = "fixed";
        if (element.type === "frame" && semantic.layout)
          semantic = {
            ...semantic,
            layout: {
              ...semantic.layout,
              [axis === "width" ? "widthSizing" : "heightSizing"]: "fixed",
            },
          };
      }
    }
  batch.editor.apply([
    { type: "replaceVisual", id, visual },
    ...(semantic !== element.semantic
      ? [{ type: "updateSemantic" as const, id, semantic }]
      : []),
  ]);
  batch.touchedPages.add(element.page);
}
