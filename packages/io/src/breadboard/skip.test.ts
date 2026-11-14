import { expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import { exportD2 } from "../d2/export.ts";
import { exportMermaid } from "../mermaid/export.ts";

function element(id: string, type: string, page = "breadboard"): Element {
  return {
    id,
    index: id,
    type,
    semantic: type === "node.generic" ? { label: "Keep me" } : {},
    visual: { x: 0, y: 0, width: 10, height: 10 },
    page,
  };
}

function document(elements: readonly Element[]): Document {
  return {
    schemaVersion: 1,
    id: "doc",
    title: "Exports",
    pages: [
      { id: "breadboard", name: "Board", kind: "breadboard" },
      { id: "freeform", name: "Freeform", kind: "freeform" },
    ],
    elements,
  };
}

test("D2 skips breadboard parts and wires with one pinned warning", () => {
  const report = exportD2(
    document([
      element("resistor", "breadboard.resistor"),
      element("wire", "breadboard.wire"),
    ]),
    "breadboard",
  );
  expect(report.code).not.toContain("resistor");
  expect(report.code).not.toContain("wire");
  expect(report.warnings).toEqual([
    { message: "Breadboard elements are not exported to D2." },
  ]);
});

test("D2 leaves a freeform node unchanged", () => {
  const report = exportD2(
    document([element("node", "node.generic", "freeform")]),
    "freeform",
  );
  expect(report.code).toContain('n_node: "Keep me"');
});

test("Mermaid has no breadboard nodes", () => {
  const report = exportMermaid(
    document([element("resistor", "breadboard.resistor")]),
    "breadboard",
    "flowchart",
  );
  expect(report.elementCount).toBe(0);
  expect(report.relationCount).toBe(0);
  expect(report.code).toBe("flowchart TD\n");
});
