import type { Vec } from "@nodetto/core";
import { BREADBOARD_PITCH, type Element } from "@nodetto/ir";

export function schematicDraftPath(
  draft: readonly Vec[] | null,
): string | null {
  return draft?.length ? draft.map((p) => `${p.x},${p.y}`).join(" ") : null;
}

export function schematicWireHandles(
  element: Element | undefined,
  selected: boolean,
) {
  if (!selected || element?.type !== "schematic.wire") return [];
  const points = (element.semantic as { points: readonly Vec[] }).points;
  return points.map((point, index) => ({
    index,
    at: {
      x: (element.visual.x ?? 0) + point.x,
      y: (element.visual.y ?? 0) + point.y,
    },
    label:
      index === 0
        ? "Wire start"
        : index === points.length - 1
          ? "Wire end"
          : `Wire bend ${index + 1} of ${points.length}`,
  }));
}

export function schematicHandleKey(
  key: string,
  _shiftKey: boolean,
): { dx: number; dy: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { dx: -BREADBOARD_PITCH, dy: 0 };
    case "ArrowRight":
      return { dx: BREADBOARD_PITCH, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: -BREADBOARD_PITCH };
    case "ArrowDown":
      return { dx: 0, dy: BREADBOARD_PITCH };
    default:
      return null;
  }
}

export function schematicFocusAfterNudge(
  result: number | null,
  current: number,
): number {
  return result ?? current;
}

export function schematicNoticeLabel(
  notice: string | null,
  draft: readonly Vec[] | null,
) {
  return notice === null ? null : { text: notice, at: draft?.at(-1) ?? null };
}
