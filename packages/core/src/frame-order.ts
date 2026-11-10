import type { ElementId, PageId } from "@nodetto/ir";
import { frameParents } from "./frame-tree.ts";
import type { ShapeContext } from "./shape-util.ts";
import type { Store } from "./store.ts";

/** Return visible top-level artboards in row-major reading order. */
export function orderedTopLevelFrames(
  store: Store,
  pageId: PageId,
  context: ShapeContext,
): readonly ElementId[] {
  const parents = frameParents(store, pageId, context);
  const frames = store.getPageElements(pageId).flatMap((element) => {
    if (
      element.type !== "frame" ||
      parents.has(element.id) ||
      context.isHidden?.(element.id)
    )
      return [];
    const bounds = context.boundsOf(element.id);
    return bounds ? [{ id: element.id, ...bounds }] : [];
  });
  const idOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  frames.sort((a, b) => a.y - b.y || a.x - b.x || idOrder(a.id, b.id));
  const rows: (typeof frames)[] = [];
  for (const frame of frames) {
    const row = rows[rows.length - 1];
    if (!row || frame.y >= row[0].y + row[0].height / 2) rows.push([frame]);
    else row.push(frame);
  }
  return rows.flatMap((row) =>
    row
      .sort((a, b) => a.x - b.x || idOrder(a.id, b.id))
      .map((frame) => frame.id),
  );
}

export function frameFileStem(index: number, name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/g, "") || "frame";
  return `${String(index + 1).padStart(2, "0")}-${slug}`;
}
