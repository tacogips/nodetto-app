import { expect, test } from "bun:test";
import type { Document } from "@nodetto/ir";
import { parseDocument } from "./parse.ts";
import { serializeDocument } from "./serialize.ts";

const base: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Test",
  pages: [{ id: "p", name: "Page", kind: "freeform" }],
  elements: [
    {
      id: "e",
      page: "p",
      type: "rect",
      index: "a0",
      semantic: {},
      visual: { componentKey: "component" },
    },
  ],
};

test("linkId round-trips in canonical order", () => {
  const doc = {
    ...base,
    elements: [
      {
        ...base.elements[0]!,
        visual: { componentKey: "component", linkId: "linked" },
      },
    ],
  };
  const text = serializeDocument(doc);
  const parsed = parseDocument(text);
  expect(parsed.elements[0]?.visual.linkId).toBe("linked");
  expect(text).toContain('"componentKey":"component","linkId":"linked"');
  expect(serializeDocument(parsed)).toBe(text);
});

test("legacy JSONL without linkId remains byte-identical", () => {
  const text = serializeDocument(base);
  expect(text).not.toContain("linkId");
  expect(serializeDocument(parseDocument(text))).toBe(text);
});
