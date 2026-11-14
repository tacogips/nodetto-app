import type { ElementId, FrameSemantic, PageId } from "@nodetto/ir";
import type { Command } from "./commands.ts";
import { compareFractional } from "./fractional.ts";
import { expandContainers } from "./frame-tree.ts";
import type { Box } from "./geometry.ts";
import type { ShapeContext } from "./shape-util.ts";
import type { Store } from "./store.ts";

/** Select the innermost frame that fully contains a new or moved element. */
export function findInsertionParent(
  store: Store,
  pageId: PageId,
  box: Box,
  context: ShapeContext,
  exclude: ReadonlySet<ElementId> = new Set(),
): ElementId | undefined {
  const excluded = new Set(expandContainers(store, exclude, context));
  let best: { id: ElementId; index: string; area: number } | undefined;
  for (const frame of store.getPageElements(pageId)) {
    if (frame.type !== "frame" || excluded.has(frame.id)) continue;
    const bounds = context.boundsOf(frame.id);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) continue;
    if (
      box.x < bounds.x ||
      box.y < bounds.y ||
      box.x + box.width > bounds.x + bounds.width ||
      box.y + box.height > bounds.y + bounds.height
    )
      continue;
    const area = bounds.width * bounds.height;
    if (
      !best ||
      area < best.area ||
      (area === best.area && compareFractional(frame.index, best.index) > 0)
    ) {
      best = { id: frame.id, index: frame.index, area };
    }
  }
  return best?.id;
}

/** Attach to an explicit frame; geometric frames need no semantic change. */
export function planAttachToFrame(
  store: Store,
  frameId: ElementId,
  elementId: ElementId,
  memberIndex?: number,
): Command[] {
  const frame = store.get(frameId);
  if (!frame || frame.type !== "frame") return [];
  const semantic = frame.semantic as FrameSemantic;
  if (!semantic.memberIds || semantic.memberIds.includes(elementId)) return [];
  const members = [...semantic.memberIds];
  members.splice(
    Math.max(0, Math.min(memberIndex ?? members.length, members.length)),
    0,
    elementId,
  );
  return [
    {
      type: "updateSemantic",
      id: frameId,
      semantic: { ...semantic, memberIds: members },
    },
  ];
}
