import { expect, test } from "bun:test";
import { VISUAL_STYLE_KEY_ORDER } from "./keyOrder.ts";
import type { Document } from "./types.ts";
import { validateDocument } from "./validate.ts";

test("box label marker is a known optional boolean", () => {
  const doc: Document = {
    schemaVersion: 1,
    id: "doc",
    title: "Widget",
    pages: [{ id: "page", name: "Page", kind: "freeform" }],
    elements: [
      {
        id: "box",
        page: "page",
        type: "node.generic",
        index: "a0",
        semantic: { label: "Widget" },
        visual: { style: { boxLabelAlign: true } },
      },
    ],
  };
  expect(VISUAL_STYLE_KEY_ORDER.keys).toContain("boxLabelAlign");
  expect(
    validateDocument(doc).filter((issue) =>
      issue.path.includes("boxLabelAlign"),
    ),
  ).toEqual([]);
  const invalid = structuredClone(doc) as unknown as {
    elements: { visual: { style: { boxLabelAlign: unknown } } }[];
  };
  invalid.elements[0]!.visual.style.boxLabelAlign = "yes";
  expect(
    validateDocument(invalid as unknown as Document).some(
      (issue) =>
        issue.path.includes("boxLabelAlign") && issue.severity === "error",
    ),
  ).toBe(true);
});
