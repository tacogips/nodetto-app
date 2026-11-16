import type { Element, ElementId } from "@nodetto/ir";
import { boxCenter, boxContains, type Box, type Vec } from "../geometry.ts";
export function referencePageFrame(
  frames: readonly Element[],
  boxes: ReadonlyMap<ElementId, Box>,
  center: Vec,
  selected: ElementId | null,
): ElementId | null {
  for (const frame of frames) {
    const box = boxes.get(frame.id);
    if (box && boxContains(box, center)) return frame.id;
  }
  if (selected !== null && frames.some((frame) => frame.id === selected))
    return selected;
  let nearest: ElementId | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const frame of frames) {
    const box = boxes.get(frame.id);
    if (!box) continue;
    const point = boxCenter(box);
    const d = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
    if (d < distance) {
      distance = d;
      nearest = frame.id;
    }
  }
  return nearest;
}
export function neighbourPageFrame(
  frames: readonly Element[],
  from: ElementId,
  direction: "next" | "previous",
): ElementId | null {
  const index = frames.findIndex((frame) => frame.id === from);
  if (index < 0) return null;
  return frames[index + (direction === "next" ? 1 : -1)]?.id ?? null;
}
