import type {
  Element,
  UseCaseNodeKind,
  UseCaseNodeSemantic,
} from "@nodetto/ir";
import { boxContains, type Box } from "../geometry.ts";
import type { ShapeUtil } from "../shape-util.ts";
import type { NotationPrimitive } from "../bpmn/notation.ts";
import { wrapTextLines } from "../text-layout.ts";
import { createConnectorUtil, readDirectEndpoints } from "./connector.ts";

/** Default size of each use-case node kind, in page units. */
export const USECASE_NODE_SIZES: Readonly<
  Record<UseCaseNodeKind, { readonly width: number; readonly height: number }>
> = {
  actor: { width: 64, height: 112 },
  usecase: { width: 160, height: 72 },
  system: { width: 400, height: 320 },
};

/** Border band and title strip that pick a system boundary. */
const SYSTEM_BORDER = 8;
const SYSTEM_TITLE = 28;

function useCaseKind(element: Element): UseCaseNodeKind {
  const kind = (element.semantic as Partial<UseCaseNodeSemantic>).kind;
  return kind === "actor" || kind === "system" ? kind : "usecase";
}

export function useCaseNodeBounds(element: Element): Box {
  const size = USECASE_NODE_SIZES[useCaseKind(element)];
  return {
    x: element.visual.x ?? 0,
    y: element.visual.y ?? 0,
    width: element.visual.width ?? size.width,
    height: element.visual.height ?? size.height,
  };
}

export const useCaseNodeShapeUtil: ShapeUtil = {
  type: "usecase.node",
  canResize: true,
  getBounds: useCaseNodeBounds,
  hitTest(element, point) {
    const b = useCaseNodeBounds(element);
    if (!boxContains(b, point)) return false;
    const kind = useCaseKind(element);
    if (kind === "actor") return true;
    if (kind === "system")
      // Like a frame, the interior stays free so contained use cases remain
      // clickable even when the boundary is stacked above them.
      return (
        point.x <= b.x + SYSTEM_BORDER ||
        point.x >= b.x + b.width - SYSTEM_BORDER ||
        point.y <= b.y + SYSTEM_TITLE ||
        point.y >= b.y + b.height - SYSTEM_BORDER
      );
    const x = (point.x - b.x - b.width / 2) / (b.width / 2);
    const y = (point.y - b.y - b.height / 2) / (b.height / 2);
    return x * x + y * y <= 1;
  },
  resize: (_element, box) => ({ visual: box }),
  defaultSemantic: () => ({ name: "Use case", kind: "usecase" }),
  defaultVisual: () => ({ x: 0, y: 0, ...USECASE_NODE_SIZES.usecase }),
};

export const useCaseRelationshipShapeUtil = createConnectorUtil({
  type: "usecase.relationship",
  readEndpoints: readDirectEndpoints,
  defaultSemantic: () => ({ from: "", to: "", kind: "association" }),
});

/** An actor's name may spread wider than the narrow figure above it. */
const ACTOR_LABEL_WIDTH = 104;

function actorNameLines(name: string, box: Box, fontSize: number): string[] {
  return name.trim()
    ? wrapTextLines(
        name.trim(),
        Math.max(box.width - 4, ACTOR_LABEL_WIDTH),
        fontSize,
      ).map((line) => line.trim())
    : [];
}

/** Page-space bounds of an actor name wider than its box, for export framing. */
export function useCaseNodeLabelBox(element: Element, box: Box): Box | null {
  if (useCaseKind(element) !== "actor") return null;
  const name = (element.semantic as Partial<UseCaseNodeSemantic>).name ?? "";
  const fontSize = element.visual.style?.fontSize ?? 13;
  const lines = actorNameLines(name, box, fontSize);
  const width = Math.max(box.width, ACTOR_LABEL_WIDTH);
  if (!lines.length || width <= box.width) return null;
  const height = lines.length * (fontSize + 2) + 4;
  return {
    x: box.x + box.width / 2 - width / 2,
    y: box.y + box.height - height,
    width,
    height,
  };
}

/** Shared notation for the canvas and vector/raster exports. */
export function useCaseNodeNotation(
  element: Element,
  box: Box,
): readonly NotationPrimitive[] {
  const kind = useCaseKind(element);
  const name = (element.semantic as Partial<UseCaseNodeSemantic>).name ?? "";
  const style = element.visual.style;
  const ink = style?.stroke ?? "#1e293b";
  const color = style?.color ?? ink;
  const fontSize = style?.fontSize ?? 13;
  const lineHeight = fontSize + 2;
  const strokeWidth = style?.strokeWidth ?? 1.5;
  const { x, y, width: w, height: h } = box;
  const text = (
    lines: readonly string[],
    baseline: number,
  ): NotationPrimitive => ({
    kind: "text",
    role: "usecase-name",
    x: x + w / 2,
    y: baseline,
    lines,
    anchor: "middle",
    fontSize,
    lineHeight,
    fill: color,
    stroke: "none",
  });
  const parts: NotationPrimitive[] = [];
  if (kind === "actor") {
    const lines = actorNameLines(name, box, fontSize);
    const labelHeight = lines.length ? lines.length * lineHeight + 4 : 0;
    const top = y + 2;
    const figure = Math.max(8, h - labelHeight - 4);
    const r = Math.max(2, Math.min(figure * 0.11, w / 4));
    const cx = x + w / 2;
    const neck = top + 2 * r;
    const shoulders = top + figure * 0.36;
    const hip = top + figure * 0.64;
    const foot = top + figure;
    const reach = Math.max(2, Math.min(w / 2 - 2, figure * 0.25));
    parts.push(
      {
        kind: "circle",
        role: "usecase-actor-head",
        cx,
        cy: top + r,
        r,
        stroke: ink,
        fill: style?.fill ?? "#ffffff",
        strokeWidth,
      },
      {
        kind: "path",
        role: "usecase-actor-body",
        d: `M${cx} ${neck}L${cx} ${hip}M${cx - reach} ${shoulders}L${cx + reach} ${shoulders}M${cx - reach} ${foot}L${cx} ${hip}L${cx + reach} ${foot}`,
        stroke: ink,
        fill: "none",
        strokeWidth,
      },
    );
    if (lines.length) parts.push(text(lines, foot + 4 + fontSize * 0.85));
    return parts;
  }
  if (kind === "system") {
    parts.push({
      kind: "rect",
      role: "usecase-system",
      x: x + 0.5,
      y: y + 0.5,
      width: Math.max(0, w - 1),
      height: Math.max(0, h - 1),
      stroke: ink,
      fill: style?.fill ?? "none",
      strokeWidth,
    });
    if (name.trim())
      parts.push(
        text(
          wrapTextLines(name.trim(), Math.max(1, w - 16), fontSize).slice(0, 1),
          y + 8 + fontSize * 0.85,
        ),
      );
    return parts;
  }
  const rx = Math.max(1, w / 2 - 1);
  const ry = Math.max(1, h / 2 - 1);
  parts.push({
    kind: "path",
    role: "usecase",
    d: `M${x + 1} ${y + h / 2}a${rx} ${ry} 0 1 0 ${w - 2} 0a${rx} ${ry} 0 1 0 ${2 - w} 0`,
    stroke: ink,
    fill: style?.fill ?? "#ffffff",
    strokeWidth,
  });
  if (name.trim()) {
    // The inscribed rectangle of an ellipse is about 70% of its width.
    const lines = wrapTextLines(
      name.trim(),
      Math.max(1, w * 0.7),
      fontSize,
    ).map((line) => line.trim());
    parts.push(
      text(
        lines,
        y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35,
      ),
    );
  }
  return parts;
}
