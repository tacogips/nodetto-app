import type { Visual } from "@nodetto/ir";
import { NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT } from "./shapes/node.ts";
import { wrapTextLines } from "./text-layout.ts";

/** One layout for the canvas label and all SVG-derived exports. */
export function nodeLabelLayout(label: string, visual: Visual) {
  const fontSize = visual.style?.fontSize ?? 13;
  const lineHeight = fontSize * (visual.style?.lineHeight ?? 1.2);
  const width = Math.max(0, (visual.width ?? NODE_DEFAULT_WIDTH) - 20);
  const height = Math.max(0, visual.height ?? NODE_DEFAULT_HEIGHT);
  const lines = wrapTextLines(
    label,
    Math.max(1, width),
    fontSize,
    visual.style?.letterSpacing ?? 0,
  );
  return {
    lines,
    fontSize,
    lineHeight,
    width,
    height,
    top: Math.max(0, (height - lines.length * lineHeight) / 2),
  };
}
