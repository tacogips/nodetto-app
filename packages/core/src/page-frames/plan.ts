import type { ElementId } from "@nodetto/ir";
import type { Command } from "../commands.ts";
import { planElementMoves } from "../editor/transform.ts";
import { expandContainers } from "../frame-tree.ts";
import type { Box } from "../geometry.ts";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { Store } from "../store.ts";
import type { PageFlow } from "./order.ts";
import { pageFrameSize, type PageOrientation } from "./presets.ts";
export const PAGE_FRAME_GAP = 48;
export interface PageFrameGeometry extends Box {
  id: ElementId;
  page: { size: string; orientation: PageOrientation };
}
export interface AddPageFrameGeometryInput {
  flow: PageFlow;
  frames: readonly PageFrameGeometry[];
  anchorId: ElementId | null;
  contentBounds: Box | null;
  size?: string;
  orientation?: PageOrientation;
}
export function planAddPageFrameGeometry(input: AddPageFrameGeometryInput) {
  const index = input.frames.findIndex((frame) => frame.id === input.anchorId);
  const anchor = input.frames[index];
  const size =
    input.size ??
    anchor?.page.size ??
    (input.flow === "vertical" ? "a4" : "slide-16-9");
  const orientation =
    input.orientation ??
    anchor?.page.orientation ??
    (input.flow === "vertical" ? "portrait" : "landscape");
  const dimensions = pageFrameSize(size, orientation, anchor);
  const base = anchor ?? input.contentBounds;
  const x = base
    ? input.flow === "horizontal"
      ? base.x + base.width + PAGE_FRAME_GAP
      : base.x
    : 0;
  const y = base
    ? input.flow === "vertical"
      ? base.y + base.height + PAGE_FRAME_GAP
      : base.y
    : 0;
  const shifted = anchor
    ? input.frames.slice(index + 1).map((frame) => ({
        id: frame.id,
        dx: input.flow === "horizontal" ? dimensions.width + PAGE_FRAME_GAP : 0,
        dy: input.flow === "vertical" ? dimensions.height + PAGE_FRAME_GAP : 0,
      }))
    : [];
  return { x, y, ...dimensions, size, orientation, shifted };
}
export function planReflowPageFrames(
  frames: readonly (Box & { id: ElementId })[],
  flow: PageFlow,
): { id: ElementId; dx: number; dy: number }[] {
  const first = frames[0];
  if (!first) return [];
  let end =
    flow === "vertical" ? first.y + first.height : first.x + first.width;
  const moves: { id: ElementId; dx: number; dy: number }[] = [];
  for (const frame of frames.slice(1)) {
    const x = flow === "horizontal" ? end + PAGE_FRAME_GAP : first.x;
    const y = flow === "vertical" ? end + PAGE_FRAME_GAP : first.y;
    const dx = x - frame.x;
    const dy = y - frame.y;
    if (dx || dy) moves.push({ id: frame.id, dx, dy });
    end = flow === "vertical" ? y + frame.height : x + frame.width;
  }
  return moves;
}
export function planShiftPageFrames(
  store: Store,
  registry: ShapeUtilRegistry,
  frames: readonly { id: ElementId; dx: number; dy: number }[],
): Command[] {
  const context = createShapeContext(store, registry, 1);
  const seen = new Set<ElementId>();
  const moves: { id: ElementId; x: number; y: number }[] = [];
  for (const frame of frames)
    for (const id of expandContainers(store, [frame.id], context)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const element = store.get(id);
      if (!element) continue;
      moves.push({
        id,
        x: (element.visual.x ?? 0) + frame.dx,
        y: (element.visual.y ?? 0) + frame.dy,
      });
    }
  return planElementMoves(store, moves);
}
