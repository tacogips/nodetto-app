import { describe, expect, test } from "bun:test";
import { BREADBOARD_TOOLS, creationFor, Tool } from "./tools.ts";
import { additionalShapes, workspaceShapes } from "./shape-palette.ts";
import { workspaceById } from "./workspaces.ts";

describe("breadboard palette", () => {
  test("selects the breadboard workspace tools and lists remaining parts", () => {
    expect(workspaceById("breadboard").label).toBe("Breadboard");
    expect(workspaceShapes("breadboard").map((item) => item.tool)).toEqual([
      Tool.BreadboardHalf,
      Tool.BreadboardResistor,
      Tool.BreadboardLed,
      Tool.BreadboardButton,
      Tool.BreadboardWire,
    ]);
    expect(additionalShapes("breadboard").map((item) => item.tool)).toContain(
      Tool.BreadboardFull,
    );
    expect(additionalShapes("breadboard").map((item) => item.tool)).toContain(
      Tool.BreadboardCapacitorElectrolytic,
    );
  });

  test("maps each tool to a typed creation and semantic variant", () => {
    expect(creationFor(Tool.BreadboardMini)).toMatchObject({
      type: "breadboard.board",
      semantic: { size: "mini" },
    });
    expect(creationFor(Tool.BreadboardCapacitorElectrolytic)).toMatchObject({
      type: "breadboard.capacitor",
      semantic: { style: "electrolytic" },
    });
    expect(BREADBOARD_TOOLS.every((tool) => creationFor(tool) !== null)).toBe(
      true,
    );
  });
});
