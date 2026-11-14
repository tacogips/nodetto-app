import { breadboardNotation, type Box } from "@nodetto/core";
import type { BreadboardPrimitive } from "@nodetto/core";
import type { Element } from "@nodetto/ir";

export interface BreadboardViewModel {
  readonly body: readonly BreadboardPrimitive[];
  readonly labels: readonly BreadboardPrimitive[];
  readonly labelTransform: string | undefined;
}

export function breadboardViewModel(
  element: Element,
  box: Box,
  inert: boolean,
): BreadboardViewModel {
  const notation = breadboardNotation(element, box, { inert });
  const rotation = element.visual.rotation ?? 0;
  return {
    body: notation.body,
    labels: notation.labels,
    labelTransform:
      rotation === 0
        ? undefined
        : `rotate(${-rotation} ${box.width / 2} ${box.height / 2})`,
  };
}
