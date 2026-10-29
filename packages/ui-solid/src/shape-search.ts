// The palette's search box: every palette shape, whatever the current mode,
// matched against the shared shape catalogue (shape ID, label, category and
// element type) and the label the palette shows.

import { SHAPE_CATALOGUE, searchShapes } from "@nodetto/core";
import {
  ARTBOARD_SHAPES,
  BPMN_SHAPES,
  BREADBOARD_SHAPES,
  COMMON_SHAPES,
  DIAGRAM_SHAPES,
  INTERACTION_SHAPES,
  PCB_SHAPES,
  type ShapePaletteItem,
  UI_CONTROL_SHAPES,
} from "./shape-palette.ts";
import type { ToolKind } from "./tools.ts";

function paletteItems(): readonly ShapePaletteItem[] {
  const byTool = new Map<ToolKind, ShapePaletteItem>();
  for (const item of [
    ...COMMON_SHAPES,
    ...DIAGRAM_SHAPES,
    ...BPMN_SHAPES,
    ...BREADBOARD_SHAPES,
    ...PCB_SHAPES,
    ...ARTBOARD_SHAPES,
    ...UI_CONTROL_SHAPES,
    ...INTERACTION_SHAPES,
  ])
    if (!byTool.has(item.tool)) byTool.set(item.tool, item);
  return [...byTool.values()];
}

/** Palette shapes whose catalogue entry or palette label has every word. */
export function searchPaletteShapes(
  query: string,
): readonly ShapePaletteItem[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const matched = new Set(
    searchShapes({ query }).map((shape): ToolKind => shape.id),
  );
  const rank = new Map(
    SHAPE_CATALOGUE.map((shape, index): [ToolKind, number] => [
      shape.id,
      index,
    ]),
  );
  return paletteItems()
    .filter(
      (item) =>
        matched.has(item.tool) ||
        words.every((word) => item.label.toLowerCase().includes(word)),
    )
    .sort(
      (left, right) =>
        (rank.get(left.tool) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.tool) ?? Number.MAX_SAFE_INTEGER),
    );
}
