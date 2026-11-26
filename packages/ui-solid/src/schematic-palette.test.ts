import { expect, test } from "bun:test";
import { SCHEMATIC_TOOLS, Tool } from "./tools.ts";
import {
  additionalShapes,
  shapePaletteGroups,
  workspaceShapes,
} from "./shape-palette.ts";
import { workspaceById } from "./workspaces.ts";

test("schematic workspace exposes all tools once", () => {
  expect(workspaceById("schematic")).toMatchObject({
    label: "Schematic",
    design: false,
    shapes: false,
  });
  const primary = workspaceShapes("schematic").map((item) => item.tool);
  expect(primary).toEqual([
    Tool.SchematicResistor,
    Tool.SchematicCapacitor,
    Tool.SchematicGround,
    Tool.SchematicWire,
    Tool.SchematicLabel,
  ]);
  const all = [
    ...primary,
    ...additionalShapes("schematic").map((item) => item.tool),
  ];
  expect(new Set(all).size).toBe(all.length);
  for (const tool of SCHEMATIC_TOOLS) expect(all).toContain(tool);
  const group = shapePaletteGroups("schematic")[0];
  expect(group?.label).toBe("Schematic");
  expect(group?.items.map((item) => item.tool).sort()).toEqual(
    [...SCHEMATIC_TOOLS].sort(),
  );
});
