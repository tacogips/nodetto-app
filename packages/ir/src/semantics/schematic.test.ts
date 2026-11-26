import { describe, expect, test } from "bun:test";
import { PAGE_KINDS, PAGE_MODES, pageModeOf } from "../types.ts";
import {
  SCHEMATIC_ELEMENT_TYPES,
  SCHEMATIC_PART_TYPES,
  SCHEMATIC_REFERENCE_PREFIX,
  isSchematicElementType,
  isSchematicPartType,
} from "./schematic.ts";

describe("schematic semantics", () => {
  test("registers a dedicated page kind and mode", () => {
    expect(PAGE_KINDS).toContain("schematic");
    expect(PAGE_MODES).toContain("schematic");
    expect(pageModeOf({ kind: "schematic" })).toBe("schematic");
  });
  test("lists eighteen element types with thirteen parts first", () => {
    expect(SCHEMATIC_ELEMENT_TYPES).toHaveLength(18);
    expect(SCHEMATIC_PART_TYPES).toHaveLength(13);
    expect(SCHEMATIC_ELEMENT_TYPES.slice(0, 13)).toEqual([
      ...SCHEMATIC_PART_TYPES,
    ]);
    expect(new Set(SCHEMATIC_ELEMENT_TYPES).size).toBe(18);
  });
  test("recognizes schematic elements and parts", () => {
    expect(isSchematicElementType("schematic.wire")).toBe(true);
    expect(isSchematicElementType("breadboard.wire")).toBe(false);
    expect(isSchematicPartType("schematic.wire")).toBe(false);
    expect(isSchematicPartType("schematic.ic")).toBe(true);
  });
  test("assigns a prefix to every part", () => {
    for (const type of SCHEMATIC_PART_TYPES)
      expect(SCHEMATIC_REFERENCE_PREFIX[type]).toBeTruthy();
    expect(SCHEMATIC_REFERENCE_PREFIX["schematic.ic"]).toBe("U");
  });
});
