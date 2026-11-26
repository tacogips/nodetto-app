import { expect, test } from "bun:test";
import type { Document } from "@nodetto/ir";
import { exportD2 } from "../d2/export.ts";
import { exportMermaid } from "../mermaid/export.ts";

const document: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Circuit",
  pages: [{ id: "page", name: "Circuit", kind: "schematic" }],
  elements: [
    {
      id: "resistor",
      page: "page",
      index: "a0",
      type: "schematic.resistor",
      semantic: { reference: "R1", value: "10k" },
      visual: { x: 0, y: 0 },
    },
    {
      id: "wire",
      page: "page",
      index: "a1",
      type: "schematic.wire",
      semantic: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      },
      visual: { x: 0, y: 0 },
    },
  ],
};

test("D2 skips schematic elements with one warning", () => {
  const result = exportD2(document, "page");
  expect(result.code).not.toContain("resistor");
  expect(result.code).not.toContain("wire");
  expect(result.warnings).toEqual([
    { message: "Schematic elements are not exported to D2." },
  ]);
});

test("Mermaid skips schematic elements", () => {
  const result = exportMermaid(document, "page", "flowchart");
  expect(result.elementCount).toBe(0);
  expect(result.relationCount).toBe(0);
  expect(result.code).toBe("flowchart TD\n");
});
