import { describe, expect, test } from "bun:test";
import { Editor, schematicPins } from "@nodetto/core";
import { createInteraction } from "./interaction.ts";
import { Tool, type ToolKind } from "./tools.ts";

function makeInteraction(initial: ToolKind) {
  const editor = new Editor();
  editor.setPageKind(editor.currentPageId, "schematic");
  let tool = initial;
  const interaction = createInteraction(editor, {
    tool: () => tool,
    setTool: (value) => {
      tool = value;
    },
    container: () => undefined,
  });
  return { editor, interaction, tool: () => tool };
}

describe("schematic creation interaction", () => {
  test("places and selects an annotated resistor at the snapped anchor", () => {
    const { editor, interaction, tool } = makeInteraction(
      Tool.SchematicResistor,
    );
    interaction.placeTool(Tool.SchematicResistor, { x: 33, y: 47 });
    const resistor = editor.store.getPageElements(editor.currentPageId)[0];
    if (!resistor) throw new Error("Expected resistor placement");
    expect(resistor.type).toBe("schematic.resistor");
    expect(resistor.semantic).toMatchObject({ reference: "R1" });
    expect(schematicPins(resistor)[0]).toMatchObject({ x: 30, y: 50 });
    expect([...editor.selection.ids()]).toEqual([resistor.id]);
    expect(tool()).toBe(Tool.Select);
  });

  test("places and selects a snapped default net label", () => {
    const { editor, interaction, tool } = makeInteraction(Tool.SchematicLabel);
    interaction.placeTool(Tool.SchematicLabel, { x: 33, y: 47 });
    const label = editor.store.getPageElements(editor.currentPageId)[0];
    if (!label) throw new Error("Expected label placement");
    expect(label.type).toBe("schematic.label");
    expect(label.semantic).toMatchObject({ net: "NET" });
    expect(label.visual).toMatchObject({ x: 30, y: 50 });
    expect([...editor.selection.ids()]).toEqual([label.id]);
    expect(tool()).toBe(Tool.Select);
  });

  test("leaves wire creation to the wire gesture", () => {
    const { editor, interaction } = makeInteraction(Tool.SchematicWire);
    interaction.placeTool(Tool.SchematicWire, { x: 33, y: 47 });
    expect(editor.store.getPageElements(editor.currentPageId)).toHaveLength(0);
  });
});
