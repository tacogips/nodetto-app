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
  ICON_PALETTE_ITEM,
  iosKitShapes,
  PCB_SHAPES,
  type ShapePaletteItem,
  UI_CONTROL_SHAPES,
} from "./shape-palette.ts";
import type { ToolKind } from "./tools.ts";

function paletteItems(): readonly ShapePaletteItem[] {
  const byTool = new Map<string, ShapePaletteItem>();
  for (const item of [
    ...COMMON_SHAPES,
    ...DIAGRAM_SHAPES,
    ...BPMN_SHAPES,
    ...BREADBOARD_SHAPES,
    ...PCB_SHAPES,
    ...ARTBOARD_SHAPES,
    ...UI_CONTROL_SHAPES,
    ...INTERACTION_SHAPES,
    ICON_PALETTE_ITEM,
    ...iosKitShapes(),
  ]) {
    const key = item.kitId ?? item.action ?? item.tool;
    if (!byTool.has(key)) byTool.set(key, item);
  }
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
        words.every((word) =>
          `${item.label} ${item.kitId ?? ""}`.toLowerCase().includes(word),
        ),
    )
    .sort(
      (left, right) =>
        (rank.get(left.tool) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.tool) ?? Number.MAX_SAFE_INTEGER),
    );
}
