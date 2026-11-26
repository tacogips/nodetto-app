import { describe, expect, test } from "bun:test";
import {
  canUseTool,
  creationFor,
  SCHEMATIC_TOOLS,
  searchShapes,
  Tool,
  TOOLS,
} from "../index.ts";

describe("schematic tools", () => {
  test("exposes a creation for every schematic tool", () => {
    expect(SCHEMATIC_TOOLS).toHaveLength(23);
    for (const tool of SCHEMATIC_TOOLS) {
      expect(TOOLS).toContain(tool);
      expect(canUseTool(tool, false)).toBe(true);
      expect(canUseTool(tool, true)).toBe(false);
      expect(creationFor(tool)?.type.startsWith("schematic.")).toBe(true);
    }
    expect(creationFor(Tool.SchematicWire)).toEqual({ type: "schematic.wire" });
  });

  test("sets semantic variants", () => {
    expect(creationFor(Tool.SchematicNpn)).toEqual({
      type: "schematic.bjt",
      semantic: { polarity: "npn" },
    });
    expect(creationFor(Tool.SchematicPnp)?.semantic).toEqual({
      polarity: "pnp",
    });
    expect(creationFor(Tool.SchematicNmos)?.semantic).toEqual({ channel: "n" });
    expect(creationFor(Tool.SchematicPmos)?.semantic).toEqual({ channel: "p" });
    expect(creationFor(Tool.SchematicCapacitorPolarized)?.semantic).toEqual({
      polarized: true,
    });
    expect(creationFor(Tool.SchematicPushButton)?.semantic).toEqual({
      style: "push",
    });
    expect(creationFor(Tool.SchematicGround)?.semantic).toEqual({
      style: "ground",
      net: "GND",
    });
    expect(creationFor(Tool.SchematicPowerRail)?.semantic).toEqual({
      style: "rail",
      net: "VCC",
    });
  });

  test("catalogues every placeable schematic tool", () => {
    const entries = searchShapes({ category: "schematic" });
    expect(entries).toHaveLength(22);
    expect(entries.map((entry) => entry.id)).toEqual(
      SCHEMATIC_TOOLS.filter((tool) => tool !== Tool.SchematicWire),
    );
    expect(
      searchShapes({ category: "Schematic", query: "resistor" })[0]?.id,
    ).toBe(Tool.SchematicResistor);
  });
});
