import type { Element } from "@nodetto/ir";
import type { NotationPrimitive } from "../bpmn/notation.ts";
import type { Box } from "../geometry.ts";

export interface SequenceParticipantNotation {
  readonly primitives: readonly NotationPrimitive[];
  readonly labelBox: Box;
}

export function sequenceParticipantNotation(
  element: Element,
  headBox: Box,
  paint: { readonly ink: string; readonly surface: string },
): SequenceParticipantNotation | null {
  const kind = (element.semantic as { kind?: unknown }).kind;
  if (kind !== "actor" && kind !== "db") return null;
  const { x, y, width, height } = headBox;
  const style = element.visual.style;
  const common = {
    stroke: style?.stroke ?? paint.ink,
    fill: style?.fill ?? paint.surface,
    strokeWidth: style?.strokeWidth ?? 1.5,
  };
  if (kind === "actor") {
    const cx = x + width / 2;
    const figureHeight = Math.max(0, height - 20);
    const radius = Math.min(5, width / 4, figureHeight / 6);
    const top = y + radius;
    const neck = y + radius * 2;
    const hip = y + figureHeight * 0.65;
    const spread = Math.min(12, width / 2);
    return {
      primitives: [
        {
          kind: "circle",
          role: "participant-head",
          cx,
          cy: top,
          r: radius,
          ...common,
        },
        {
          kind: "path",
          role: "participant-body",
          d: `M${cx} ${neck} L${cx} ${hip} M${cx - spread} ${y + figureHeight * 0.4} L${cx + spread} ${y + figureHeight * 0.4} M${cx} ${hip} L${cx - spread} ${y + figureHeight} M${cx} ${hip} L${cx + spread} ${y + figureHeight}`,
          ...common,
          fill: "none",
        },
      ],
      labelBox: {
        x,
        y: y + figureHeight,
        width,
        height: height - figureHeight,
      },
    };
  }
  const ry = Math.min(8, height / 4);
  return {
    primitives: [
      {
        kind: "path",
        role: "participant-cylinder",
        d: `M${x} ${y + ry} A${width / 2} ${ry} 0 0 1 ${x + width} ${y + ry} L${x + width} ${y + height - ry} A${width / 2} ${ry} 0 0 1 ${x} ${y + height - ry} Z M${x + width} ${y + ry} A${width / 2} ${ry} 0 0 1 ${x} ${y + ry}`,
        ...common,
      },
    ],
    labelBox: { x, y: y + 2 * ry, width, height: height - 2 * ry },
  };
}
