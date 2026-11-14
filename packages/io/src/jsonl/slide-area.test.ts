import { expect, test } from "bun:test";
import type { Document } from "@nodetto/ir";
import { parseDocument } from "./parse.ts";
import { serializeDocument } from "./serialize.ts";
const base: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Test",
  pages: [{ id: "p", name: "Page", kind: "freeform" }],
  elements: [],
};
test("slide fields round trip in canonical key order", () => {
  const doc: Document = {
    ...base,
    slideSize: { height: 1080, width: 1920 },
    pages: [
      {
        id: "p",
        name: "Page",
        kind: "freeform",
        hiddenInPresentation: true,
        slideOrigin: { y: 2, x: 1 },
      },
    ],
  };
  const text = serializeDocument(doc);
  expect(text).toContain(
    '"title":"Test","slideSize":{"width":1920,"height":1080}',
  );
  expect(text).toContain(
    '"hiddenInPresentation":true,"slideOrigin":{"x":1,"y":2}',
  );
  expect(serializeDocument(parseDocument(text))).toBe(text);
  expect(parseDocument(text).slideSize).toEqual(doc.slideSize);
  expect(parseDocument(text).pages[0]?.slideOrigin).toEqual(
    doc.pages[0]?.slideOrigin,
  );
});
test("absent slide fields remain absent and byte identical", () => {
  const text = serializeDocument(base);
  const parsed = parseDocument(text);
  expect(parsed).not.toHaveProperty("slideSize");
  expect(parsed.pages[0]).not.toHaveProperty("slideOrigin");
  expect(serializeDocument(parsed)).toBe(text);
});
