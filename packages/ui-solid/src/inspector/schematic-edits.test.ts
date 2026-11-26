import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  netPatch,
  pinCountPatch,
  pinsPatch,
  writeSchematicSemantic,
} from "./schematic-edits.ts";

describe("schematic inspector edits", () => {
  test("clamps connector pin counts", () => {
    expect(pinCountPatch(50)).toEqual({ pinCount: 40 });
    expect(pinCountPatch(0)).toEqual({ pinCount: 1 });
  });
  test("trims net names and rejects empty names", () => {
    expect(netPatch("  SIGNAL  ")).toEqual({ net: "SIGNAL" });
    expect(netPatch("  ")).toBeNull();
  });
  test("validates IC pin patches", () => {
    const pins = [
      { number: 1, name: "A", side: "left" as const },
      { number: 2, name: "B", side: "right" as const },
    ];
    expect(pinsPatch(pins)).toEqual({ pins });
    expect(pinsPatch([pins[0]!, { ...pins[1]!, number: 1 }])).toBeNull();
    expect(pinsPatch([])).toBeNull();
  });
});

test("writes semantic patches through the editor", () => {
  const editor = new Editor({
    document: {
      schemaVersion: 1,
      id: "doc",
      title: "Test",
      pages: [{ id: "page", name: "Circuit", kind: "schematic" }],
      elements: [
        {
          id: "part",
          page: "page",
          type: "schematic.resistor",
          index: "a1",
          semantic: { reference: "R1", value: "10k" },
          visual: { x: 0, y: 0, width: 40, height: 20 },
        },
      ],
    },
  });
  expect(writeSchematicSemantic(editor, "part", { value: "22k" })).toBe(true);
  expect(editor.store.get("part")?.semantic).toEqual({
    reference: "R1",
    value: "22k",
  });
});
