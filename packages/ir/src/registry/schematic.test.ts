import { describe, expect, test } from "bun:test";
import { getElementTypeDefinition } from "../registry.ts";
import {
  SCHEMATIC_ELEMENT_TYPES,
  type SchematicElementType,
} from "../semantics.ts";
import { schematicDefaultSemantic } from "./schematic.ts";

function issues(type: SchematicElementType, value: unknown) {
  return (
    getElementTypeDefinition(type)?.validateSemantic(value, "semantic") ?? []
  );
}
function codes(type: SchematicElementType, value: unknown) {
  return issues(type, value).map((issue) => issue.code);
}
describe("schematic registry", () => {
  test("all defaults validate and definitions are registered", () => {
    for (const type of SCHEMATIC_ELEMENT_TYPES) {
      const definition = getElementTypeDefinition(type);
      expect(definition?.category).toBe("node");
      expect(definition?.references({})).toEqual([]);
      expect(definition?.onReferenceDeleted).toBe("detach");
      expect(issues(type, schematicDefaultSemantic(type))).toEqual([]);
    }
  });
  test("key order and coordinate rounding metadata", () => {
    expect(getElementTypeDefinition("schematic.ic")?.keyOrder).toEqual({
      keys: ["reference", "value", "pins"],
      children: { pins: { keys: ["number", "name", "side"] } },
    });
    expect(getElementTypeDefinition("schematic.wire")?.keyOrder).toEqual({
      keys: ["points"],
      children: { points: { keys: ["x", "y"], coordinates: ["x", "y"] } },
    });
    expect(
      getElementTypeDefinition("schematic.junction")?.keyOrder.keys,
    ).toEqual([]);
  });
  test("wires validate structure, orthogonality, and coordinate limits", () => {
    expect(codes("schematic.wire", { points: [] })).toContain(
      "schematic.wirePoints",
    );
    expect(codes("schematic.wire", { points: [{ x: 0, y: 0 }] })).toContain(
      "schematic.wirePoints",
    );
    expect(
      codes("schematic.wire", {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      }),
    ).toContain("schematic.wireDiagonal");
    expect(
      codes("schematic.wire", {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 5 },
        ],
      }),
    ).toEqual([]);
    expect(
      codes("schematic.wire", {
        points: [
          { x: 0, y: 0 },
          { x: 2e9, y: 0 },
        ],
      }),
    ).toContain("schematic.coordinateRange");
    expect(
      codes("schematic.wire", {
        points: [
          { x: 0, y: 0 },
          { x: 1e9, y: 0 },
        ],
      }),
    ).toEqual([]);
    expect(codes("schematic.wire", { points: null })).toContain("type.array");
  });
  test("IC pins are unique positive integers and bounded in count", () => {
    const pin = (number: number) => ({ number, name: "", side: "left" });
    const semantic = (pins: object[]) => ({
      reference: "U?",
      value: "IC",
      pins,
    });
    expect(codes("schematic.ic", semantic([pin(3), pin(3)]))).toContain(
      "schematic.icPins",
    );
    expect(
      codes(
        "schematic.ic",
        semantic(Array.from({ length: 257 }, (_, i) => pin(i + 1))),
      ),
    ).toContain("schematic.icPins");
    expect(
      codes("schematic.ic", semantic([pin(1), pin(3), pin(7), pin(9)])),
    ).toEqual([]);
    expect(codes("schematic.ic", semantic([]))).toContain("schematic.icPins");
    expect(codes("schematic.ic", semantic([pin(0)]))).toContain(
      "schematic.icPins",
    );
  });
  test("connector range and transistor enum", () => {
    const connector = { reference: "J?", value: "CONN", pinCount: 40 };
    expect(codes("schematic.connector", connector)).toEqual([]);
    expect(
      codes("schematic.connector", { ...connector, pinCount: 41 }),
    ).toContain("value.max");
    expect(
      codes("schematic.bjt", {
        reference: "Q?",
        value: "NPN",
        polarity: "xyz",
      }),
    ).toContain("value.enum");
  });
});
