import {
  frameParents,
  planAlign,
  planDistribute,
  safeAreaContentBox,
  type AlignMode,
} from "@nodetto/core";
import type { Element, FrameLayout, FrameSemantic } from "@nodetto/ir";
import type { Batch } from "../batch.ts";
import { OperationError, type JsonObject } from "../operation-input.ts";
import { resolveElementReference, selectedWhere } from "../selectors.ts";

function targets(
  batch: Batch,
  op: JsonObject,
  index: number,
  name: string,
): Element[] {
  if (op["where"] !== undefined) {
    if (op["ids"] !== undefined || op["page"] !== undefined)
      throw new OperationError(index, 'use either "where" or "ids"/"page"');
    return selectedWhere(batch, op, index, name);
  }
  if (op["ids"] !== undefined || (name === "snap" && op["page"] !== undefined))
    return batch.targets(op, index, false);
  throw new OperationError(
    index,
    `${name} needs ids or where${name === "snap" ? " or page" : ""}`,
  );
}
function parentOf(batch: Batch, e: Element): Element | undefined {
  batch.editor.setCurrentPage(e.page);
  const id = frameParents(
    batch.editor.store,
    e.page,
    batch.editor.createShapeContext(1),
  ).get(e.id);
  return id ? batch.editor.store.get(id) : undefined;
}
function warn(
  batch: Batch,
  e: Element,
  index: number,
  op: string,
  message: string,
): void {
  batch.convertWarnings.push({
    operation: index,
    op,
    element: e.id,
    type: e.type,
    path: "visual.layoutPosition",
    code: "layout.skipped",
    message,
  });
}
function movable(
  batch: Batch,
  elements: Element[],
  index: number,
  op: string,
): Element[] {
  return elements.filter((e) => {
    const parent = parentOf(batch, e);
    if (
      parent &&
      (parent.semantic as FrameSemantic).layout &&
      e.visual.layoutPosition !== "absolute"
    ) {
      warn(batch, e, index, op, `skipped ${e.id}: positioned by auto layout`);
      return false;
    }
    return true;
  });
}
export function layoutOperation(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const frame = batch.element(operation["id"], index);
  if (frame.type !== "frame")
    throw new OperationError(index, "layout requires a frame");
  const semantic = frame.semantic as FrameSemantic;
  const fields = [
    "direction",
    "gap",
    "padding",
    "align",
    "justify",
    "width",
    "height",
    "wrap",
    "crossGap",
  ];
  if (
    operation["remove"] !== undefined &&
    typeof operation["remove"] !== "boolean"
  )
    throw new OperationError(index, '"remove" must be a boolean');
  if (operation["remove"] === true) {
    if (fields.some((k) => operation[k] !== undefined))
      throw new OperationError(
        index,
        '"remove" cannot be combined with layout fields',
      );
    const { layout: _layout, ...rest } = semantic;
    batch.editor.apply([
      { type: "updateSemantic", id: frame.id, semantic: rest },
    ]);
  } else {
    const layout: Record<string, unknown> = {
      direction: "vertical",
      gap: 0,
      padding: 0,
      sizing: "fixed",
      align: "start",
      justify: "start",
      ...semantic.layout,
    };
    const enums: Record<string, readonly string[]> = {
      direction: ["vertical", "horizontal"],
      align: ["start", "center", "end", "stretch"],
      justify: ["start", "center", "end", "space-between"],
      width: ["fixed", "hug"],
      height: ["fixed", "hug"],
    };
    for (const [key, values] of Object.entries(enums))
      if (operation[key] !== undefined) {
        if (
          typeof operation[key] !== "string" ||
          !values.includes(operation[key] as string)
        )
          throw new OperationError(index, `invalid ${key}`);
        layout[
          key === "width"
            ? "widthSizing"
            : key === "height"
              ? "heightSizing"
              : key
        ] = operation[key];
      }
    for (const key of ["gap", "crossGap"])
      if (operation[key] !== undefined) {
        const value = operation[key];
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
          throw new OperationError(
            index,
            `${key} must be finite and nonnegative`,
          );
        layout[key] = value;
      }
    if (operation["wrap"] !== undefined) {
      if (typeof operation["wrap"] !== "boolean")
        throw new OperationError(index, '"wrap" must be boolean');
      layout["wrap"] = operation["wrap"];
    }
    const padding = operation["padding"];
    if (padding !== undefined) {
      const valid = (v: unknown): v is number =>
        typeof v === "number" && Number.isFinite(v) && v >= 0;
      if (valid(padding)) {
        layout["padding"] = padding;
        for (const key of [
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
        ])
          delete layout[key];
      } else if (
        Array.isArray(padding) &&
        padding.length === 4 &&
        padding.every(valid)
      ) {
        layout["padding"] = 0;
        [
          layout["paddingTop"],
          layout["paddingRight"],
          layout["paddingBottom"],
          layout["paddingLeft"],
        ] = padding;
      } else
        throw new OperationError(
          index,
          '"padding" must be a nonnegative number or four nonnegative numbers',
        );
    }
    let memberIds = semantic.memberIds;
    if (!memberIds) {
      batch.editor.setCurrentPage(frame.page);
      const context = batch.editor.createShapeContext(1);
      const parents = frameParents(batch.editor.store, frame.page, context);
      memberIds = batch.editor.store
        .getPageElements(frame.page)
        .filter((e) => parents.get(e.id) === frame.id)
        .sort((a, b) => {
          const x = context.boundsOf(a.id);
          const y = context.boundsOf(b.id);
          if (!x || !y) return a.id.localeCompare(b.id);
          return (
            (layout["direction"] === "vertical"
              ? x.y - y.y || x.x - y.x
              : x.x - y.x || x.y - y.y) || a.id.localeCompare(b.id)
          );
        })
        .map((e) => e.id);
    }
    batch.editor.apply([
      {
        type: "updateSemantic",
        id: frame.id,
        semantic: {
          ...semantic,
          memberIds,
          layout: layout as unknown as FrameLayout,
        },
      },
    ]);
  }
  batch.touchedPages.add(frame.page);
}
export function alignOperation(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const edge = operation["edge"];
  if (
    typeof edge !== "string" ||
    !["left", "hcenter", "right", "top", "vcenter", "bottom"].includes(edge)
  )
    throw new OperationError(index, "invalid alignment edge");
  const all = movable(
    batch,
    targets(batch, operation, index, "align"),
    index,
    "align",
  );
  const to = operation["to"] ?? "selection";
  if (typeof to !== "string")
    throw new OperationError(index, '"to" must be a string');
  if (to === "selection") {
    if (all.length < 2) {
      if (all.length === 0) return;
      throw new OperationError(
        index,
        "align selection needs at least two targets",
      );
    }
    batch.editor.apply(
      planAlign(
        batch.editor.store,
        all.map((e) => e.id),
        edge as AlignMode,
        batch.editor.createShapeContext(1),
      ),
    );
  } else
    for (const e of all) {
      const parent = parentOf(batch, e);
      const ref =
        to === "parent" || to === "safe-area"
          ? parent
          : resolveElementReference(batch, to, index, e.page);
      if (!ref || ref.page !== e.page)
        throw new OperationError(
          index,
          `no parent or reference on page for ${e.id}`,
        );
      const own = batch.boundsOf(e.id);
      const box = batch.boundsOf(ref.id);
      if (!own || !box) continue;
      let dest = box;
      if (to === "safe-area") {
        const safe = (ref.semantic as FrameSemantic).safeArea;
        if (safe) dest = safeAreaContentBox(box, safe);
        else
          warn(
            batch,
            e,
            index,
            "align",
            `no safe area for ${ref.id}; using frame bounds`,
          );
      }
      let x = own.x;
      let y = own.y;
      if (edge === "left") x = dest.x;
      if (edge === "hcenter") x = dest.x + (dest.width - own.width) / 2;
      if (edge === "right") x = dest.x + dest.width - own.width;
      if (edge === "top") y = dest.y;
      if (edge === "vcenter") y = dest.y + (dest.height - own.height) / 2;
      if (edge === "bottom") y = dest.y + dest.height - own.height;
      batch.moveBoxTo(e.id, x, y);
    }
  for (const e of all) batch.touchedPages.add(e.page);
}
export function distributeOperation(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const axis = operation["axis"];
  if (axis !== "horizontal" && axis !== "vertical")
    throw new OperationError(index, "invalid distribution axis");
  const gap = operation["gap"];
  if (
    gap !== undefined &&
    (typeof gap !== "number" || !Number.isFinite(gap) || gap < 0)
  )
    throw new OperationError(index, "gap must be finite and nonnegative");
  const all = movable(
    batch,
    targets(batch, operation, index, "distribute"),
    index,
    "distribute",
  );
  if (all.length < (gap === undefined ? 3 : 2)) {
    if (!all.length) return;
    throw new OperationError(index, "not enough distribution targets");
  }
  if (gap === undefined)
    batch.editor.apply(
      planDistribute(
        batch.editor.store,
        all.map((e) => e.id),
        axis,
        batch.editor.createShapeContext(1),
      ),
    );
  else {
    const horizontal = axis === "horizontal";
    const sorted = all
      .flatMap((e) => {
        const box = batch.boundsOf(e.id);
        return box ? [{ e, box }] : [];
      })
      .sort(
        (a, b) =>
          (horizontal ? a.box.x - b.box.x : a.box.y - b.box.y) ||
          a.e.id.localeCompare(b.e.id),
      );
    let end: number | undefined;
    for (const { e, box } of sorted) {
      const start = horizontal ? box.x : box.y;
      const pos = end === undefined ? start : end + gap;
      if (end !== undefined)
        batch.moveBoxTo(
          e.id,
          horizontal ? pos : box.x,
          horizontal ? box.y : pos,
        );
      end = pos + (horizontal ? box.width : box.height);
    }
  }
  for (const e of all) batch.touchedPages.add(e.page);
}
export function snapOperation(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const grid = operation["grid"];
  if (typeof grid !== "number" || ![1, 2, 4, 8].includes(grid))
    throw new OperationError(index, "grid must be 1, 2, 4 or 8");
  for (const e of movable(
    batch,
    targets(batch, operation, index, "snap"),
    index,
    "snap",
  )) {
    if (e.type.startsWith("edge.")) continue;
    const box = batch.boundsOf(e.id);
    if (!box) continue;
    const parent = parentOf(batch, e);
    const origin = parent ? batch.boundsOf(parent.id) : null;
    const round = (n: number) => Math.round(n / grid) * grid;
    const x = (origin?.x ?? 0) + round(box.x - (origin?.x ?? 0));
    const y = (origin?.y ?? 0) + round(box.y - (origin?.y ?? 0));
    batch.moveBoxTo(e.id, x, y);
    const visual: Record<string, number> = {};
    if (e.visual.textResize !== "auto-width")
      visual["width"] = Math.max(grid, round(box.width));
    if (
      e.visual.textResize !== "auto-height" &&
      e.visual.textResize !== "auto-width"
    )
      visual["height"] = Math.max(grid, round(box.height));
    if (Object.keys(visual).length)
      batch.editor.apply([{ type: "updateVisual", id: e.id, visual }]);
    batch.touchedPages.add(e.page);
  }
}
