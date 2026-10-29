import { expect, test } from "bun:test";
import { findShape } from "@nodetto/core";
import {
  ARTBOARD_SHAPES,
  BPMN_SHAPES,
  BREADBOARD_SHAPES,
  COMMON_SHAPES,
  DIAGRAM_SHAPES,
  INTERACTION_SHAPES,
  PCB_SHAPES,
  UI_CONTROL_SHAPES,
} from "./shape-palette.ts";
import { searchPaletteShapes } from "./shape-search.ts";
import { Tool } from "./tools.ts";

test("every palette shape has a shape ID in the shared catalogue", () => {
  // Wires and tracks are drawn point by point, so the CLI cannot place them.
  const pointByPoint = new Set<string>([Tool.BreadboardWire, Tool.PcbTrack]);
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
    if (!pointByPoint.has(item.tool))
      expect({
        tool: item.tool,
        found: findShape(item.tool) !== undefined,
      }).toEqual({ tool: item.tool, found: true });
});

test("palette search finds shapes in any mode by name, ID or category", () => {
  expect(searchPaletteShapes("actor").map((item) => item.tool)).toEqual([
    Tool.UseCaseActor,
    Tool.Actor,
  ]);
  const uml = searchPaletteShapes("uml").map((item) => item.tool);
  expect(uml).toContain(Tool.Class);
  expect(uml).toContain(Tool.UseCaseSystem);
  expect(uml).toContain(Tool.InitialState);
  expect(
    searchPaletteShapes("flowchart:decision").map((item) => item.tool),
  ).toEqual([Tool.FlowDecision]);
  expect(searchPaletteShapes("   ")).toEqual([]);
  expect(searchPaletteShapes("no such shape")).toEqual([]);
});
