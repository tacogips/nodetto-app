import type { Element, StateNodeSemantic } from "@nodetto/ir";
import { boxContains, type Box } from "../geometry.ts";
import type { ShapeUtil } from "../shape-util.ts";
import type { NotationPrimitive } from "../bpmn/notation.ts";
import { wrapTextLines } from "../text-layout.ts";
import { createConnectorUtil, readDirectEndpoints } from "./connector.ts";

export function stateNodeBounds(element: Element): Box {
  const kind = (element.semantic as StateNodeSemantic).kind;
  const normal = kind === "state";
  return {
    x: element.visual.x ?? 0,
    y: element.visual.y ?? 0,
    width: element.visual.width ?? (normal ? 160 : 32),
    height: element.visual.height ?? (normal ? 72 : 32),
  };
}
export const stateNodeShapeUtil: ShapeUtil = {
  type: "state.node",
  canResize: true,
  getBounds: stateNodeBounds,
  hitTest(element, point) {
    const b = stateNodeBounds(element);
    if (!boxContains(b, point)) return false;
    const kind = (element.semantic as StateNodeSemantic).kind;
    const x = (point.x - b.x - b.width / 2) / (b.width / 2);
    const y = (point.y - b.y - b.height / 2) / (b.height / 2);
    return (
      kind === "state" ||
      (kind === "choice" ? Math.abs(x) + Math.abs(y) <= 1 : x * x + y * y <= 1)
    );
  },
  resize: (_element, box) => ({ visual: box }),
  defaultSemantic: () => ({ name: "State", kind: "state" }),
  defaultVisual: () => ({ x: 0, y: 0, width: 160, height: 72 }),
};
export const stateTransitionShapeUtil = createConnectorUtil({
  type: "state.transition",
  readEndpoints: readDirectEndpoints,
  defaultSemantic: () => ({
    from: "",
    to: "",
    trigger: "",
    guard: "",
    effect: "",
  }),
});

/** Shared notation for the canvas and vector/raster exports. */
export function stateNodeNotation(
  element: Element,
  box: Box,
): readonly NotationPrimitive[] {
  const { kind, name } = element.semantic as StateNodeSemantic;
  const style = element.visual.style;
  const ink = style?.stroke ?? "#1e293b";
  const fill = style?.fill ?? "#ffffff";
  const { x, y, width: w, height: h } = box;
  const paint = {
    role: "state",
    stroke: ink,
    fill,
    strokeWidth: style?.strokeWidth ?? 1.5,
  };
  const parts: NotationPrimitive[] = [];
  if (kind === "state")
    parts.push({
      ...paint,
      kind: "rect",
      x: x + 1,
      y: y + 1,
      width: Math.max(0, w - 2),
      height: Math.max(0, h - 2),
      rx: 12,
    });
  else if (kind === "choice")
    parts.push({
      ...paint,
      kind: "polygon",
      points: [
        { x: x + w / 2, y: y + 1 },
        { x: x + w - 1, y: y + h / 2 },
        { x: x + w / 2, y: y + h - 1 },
        { x: x + 1, y: y + h / 2 },
      ],
    });
  else {
    // Scale the circular notation with the bounds, preserving ellipse picking.
    parts.push({
      ...paint,
      kind: "path",
      d: `M${x + 1} ${y + h / 2}a${Math.max(1, w / 2 - 1)} ${Math.max(1, h / 2 - 1)} 0 1 0 ${w - 2} 0a${Math.max(1, w / 2 - 1)} ${Math.max(1, h / 2 - 1)} 0 1 0 ${2 - w} 0`,
      fill: kind === "initial" ? ink : fill,
    });
    if (kind === "final")
      parts.push({
        ...paint,
        kind: "path",
        d: `M${x + w * 0.22} ${y + h / 2}a${w * 0.28} ${h * 0.28} 0 1 0 ${w * 0.56} 0a${w * 0.28} ${h * 0.28} 0 1 0 ${-w * 0.56} 0`,
        fill: ink,
      });
  }
  if (name && kind === "state") {
    const fontSize = style?.fontSize ?? 13;
    const lines = wrapTextLines(name, Math.max(1, w - 20), fontSize);
    parts.push({
      kind: "text",
      role: "state-name",
      x: x + w / 2,
      y:
        y + h / 2 - ((lines.length - 1) * (fontSize + 2)) / 2 + fontSize * 0.35,
      lines,
      anchor: "middle",
      fontSize,
      lineHeight: fontSize + 2,
      fill: style?.color ?? ink,
      stroke: "none",
    });
  }
  return parts;
}
