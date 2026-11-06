import type { Element, ElementId, FrameSemantic, PageId } from "@nodetto/ir";
import { expandContainers, frameParents } from "./frame-tree.ts";
import type { Box } from "./geometry.ts";
import type { ShapeContext } from "./shape-util.ts";
import type { Store } from "./store.ts";

export interface ErdFrameScope {
  readonly included: ReadonlySet<ElementId>;
  readonly warnings: readonly string[];
}
export function boxFullyInside(inner: Box, outer: Box): boolean {
  return (
    outer.width > 0 &&
    outer.height > 0 &&
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
    Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y)
  );
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function frameName(frame: Element): string {
  const name = (frame.semantic as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name : frame.id;
}
function tableName(table: Element): string {
  const name = (table.semantic as Record<string, unknown>).tableName;
  return typeof name === "string" && name.trim() ? name : table.id;
}
export function erdFrameScope(
  store: Store,
  page: PageId,
  frameId: ElementId,
  context: ShapeContext,
): ErdFrameScope {
  const included = new Set(expandContainers(store, [frameId], context));
  const elements = store.getPageElements(page);
  const frames = elements.filter((element) => element.type === "frame");
  const containers = frames
    .filter((frame) => included.has(frame.id))
    .map((frame) => {
      const members = (frame.semantic as FrameSemantic).memberIds;
      return {
        frame,
        members,
        box: context.boundsOf(frame.id),
        open:
          !members ||
          (members.length > 0 &&
            members.every((id) => store.get(id)?.type === "frame")),
      };
    });
  const parents = frameParents(store, page, context);
  const warnings: string[] = [];
  const selected = store.get(frameId);
  const selectedName = selected ? frameName(selected) : frameId;
  const tables = elements
    .filter(
      (element) => element.type === "erd.table" && !included.has(element.id),
    )
    .sort((a, b) => compare(tableName(a), tableName(b)) || compare(a.id, b.id));
  for (const table of tables) {
    const claimant = frames.find(
      (frame) =>
        !included.has(frame.id) &&
        (frame.semantic as FrameSemantic).memberIds?.includes(table.id),
    );
    if (claimant) {
      if (containers.some((c) => c.members?.includes(table.id)))
        warnings.push(
          `${tableName(table)}: table excluded from frame ${selectedName}: also listed in memberIds of frame ${frameName(claimant)}.`,
        );
      continue;
    }
    const box = context.boundsOf(table.id);
    if (!box) continue;
    const open = containers.filter(
      (c) => c.open && c.box && boxFullyInside(box, c.box),
    );
    const ownerId = parents.get(table.id);
    const owner =
      ownerId && !included.has(ownerId) ? store.get(ownerId) : undefined;
    const ownerBox = owner ? context.boundsOf(owner.id) : undefined;
    const competing =
      owner &&
      ownerBox &&
      open.length > 0 &&
      open.every(
        (c) =>
          c.box &&
          !boxFullyInside(ownerBox, c.box) &&
          !boxFullyInside(c.box, ownerBox),
      );
    let reason: string | undefined;
    if (competing && owner) reason = `also inside frame ${frameName(owner)}`;
    else if (open.length) {
      included.add(table.id);
      continue;
    } else {
      const closed = containers.find(
        (c) =>
          !c.open &&
          c.box &&
          boxFullyInside(box, c.box) &&
          !c.members?.includes(table.id),
      );
      const straddled = containers.find(
        (c) => c.box && boxesOverlap(box, c.box) && !boxFullyInside(box, c.box),
      );
      if (closed)
        reason = `not listed in memberIds of frame ${frameName(closed.frame)}`;
      else if (straddled)
        reason = `straddles the edge of frame ${frameName(straddled.frame)}`;
    }
    if (reason)
      warnings.push(
        `${tableName(table)}: table excluded from frame ${selectedName}: ${reason}.`,
      );
  }
  return { included, warnings };
}
