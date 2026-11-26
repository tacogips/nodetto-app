import { expect, test } from "bun:test";
import type { Document } from "@nodetto/ir";
import { element } from "../../core/src/test-helpers.ts";
import {
  SCHEMATIC_EXPORTS,
  schematicExportEnabled,
  schematicExportText,
} from "./schematic-export.ts";

test("schematic export is enabled only for schematic pages with a handler", () => {
  expect(schematicExportEnabled("schematic", true)).toBe(true);
  expect(schematicExportEnabled("schematic", false)).toBe(false);
  expect(schematicExportEnabled("breadboard", true)).toBe(false);
  expect(schematicExportEnabled(undefined, true)).toBe(false);
  expect(SCHEMATIC_EXPORTS.map((option) => option.label)).toEqual([
    "Netlist (text)",
    "KiCad netlist (.net)",
  ]);
});

test("exports a schematic netlist in both formats", () => {
  const document = {
    title: "Circuit",
    pages: [{ id: "p", name: "Sheet" }],
    elements: [
      element({
        id: "j1",
        page: "p",
        type: "schematic.connector",
        visual: { x: 0, y: 0 },
        semantic: { reference: "J1", value: "", pinCount: 1 },
      }),
    ],
  } as unknown as Document;
  const text = schematicExportText(document, "p", "text");
  const kicad = schematicExportText(document, "p", "kicad");
  expect(text.text.startsWith("# nodetto schematic netlist 1")).toBe(true);
  expect(text.text).toContain("component J1");
  expect(text.extension).toBe("txt");
  expect(text.warnings).toEqual([]);
  expect(kicad.text.startsWith('(export (version "E")')).toBe(true);
  expect(kicad.text).toContain('(ref "J1")');
  expect(kicad.extension).toBe("net");
  expect(kicad.warnings).toEqual([]);
});
