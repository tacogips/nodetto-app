import { expect, test } from "bun:test";
import type { Document } from "@nodetto/ir";
import { parseDocument } from "./parse.ts";
import { serializeDocument } from "./serialize.ts";
const base: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Doc",
  pages: [{ id: "p", name: "P", kind: "freeform" }],
  elements: [],
};
test("page flow and frame page metadata round trip canonically", () => {
  for (const pageFlow of ["horizontal", "vertical"] as const) {
    const doc: Document = {
      ...base,
      pages: [
        {
          id: "p",
          name: "P",
          kind: "freeform",
          slideOrigin: { x: 1, y: 2 },
          pageFlow,
        },
      ],
      elements: [
        {
          id: "f",
          page: "p",
          type: "frame",
          semantic: {
            name: "Frame",
            page: { size: "a4", orientation: "portrait" },
          },
          visual: { x: 0, y: 0 },
          index: "a0",
        },
      ],
    };
    const text = serializeDocument(doc);
    expect(text).toContain(
      `"slideOrigin":{"x":1,"y":2},"pageFlow":"${pageFlow}"`,
    );
    expect(serializeDocument(parseDocument(text))).toBe(text);
    expect(parseDocument(text).pages[0]?.pageFlow).toBe(pageFlow);
  }
  const text = serializeDocument(base);
  expect(serializeDocument(parseDocument(text))).toBe(text);
  expect(parseDocument(text).pages[0]).not.toHaveProperty("pageFlow");
});
