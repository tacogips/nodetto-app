import { schematicNotation, type Box } from "@nodetto/core";
import type { Element } from "@nodetto/ir";

export function schematicViewModel(element: Element, box: Box) {
  const notation = schematicNotation(element, box, {
    ink: "var(--nodetto-ink)",
    muted: "var(--nodetto-muted)",
    surface: "var(--nodetto-surface)",
    accent: "var(--nodetto-accent)",
  });
  const rotation = element.visual.rotation ?? 0;
  return {
    ...notation,
    labelTransform:
      rotation === 0
        ? undefined
        : `rotate(${-rotation} ${box.width / 2} ${box.height / 2})`,
  };
}
