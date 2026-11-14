import { describe, expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import {
  attributeMissingGlyphs,
  glyphMissingMessage,
  glyphRowsByPage,
} from "./glyph-coverage.ts";

function element(
  id: string,
  semantic: unknown,
  page = "p1",
  type = "node.generic",
  hidden = false,
): Element {
  return { id, page, type, index: "a0", semantic, visual: { hidden } };
}
function document(elements: Element[]): Document {
  return {
    schemaVersion: 1,
    id: "doc",
    title: "Widgets",
    pages: [
      { id: "p1", name: "One", kind: "erd" },
      { id: "p2", name: "Two", kind: "erd" },
    ],
    elements,
  };
}

describe("glyph attribution", () => {
  test("walks nested strings, sorts unique code points and preserves element order", () => {
    const elements = [
      element("first", { label: "⑫⑪󰀀⑪", columns: [{ type: "波" }] }),
      element("second", { label: "⑪" }),
      element("style", { name: "⑪" }, "p1", "design.text-style"),
      element("hidden", { label: "⑪" }, "p1", "node.generic", true),
    ];
    expect(
      attributeMissingGlyphs(
        elements,
        new Set([0xf0000, 0x246b, 0x246a, 0x6ce2, 0x301c]),
      ),
    ).toEqual({
      rows: [
        { elementId: "first", codePoints: [0x246a, 0x246b, 0x6ce2, 0xf0000] },
        { elementId: "second", codePoints: [0x246a] },
      ],
      unattributed: [0x301c],
    });
  });

  test("does not call coverage for ASCII or excluded elements", () => {
    let calls = 0;
    const result = glyphRowsByPage(
      document([
        element("ascii", { label: "Widget" }),
        element("style", { name: "⑪" }, "p1", "design.text-style"),
        element("hidden", { label: "⑪" }, "p2", "node.generic", true),
      ]),
      () => {
        calls++;
        return { missing: [0x246a] };
      },
    );
    expect(calls).toBe(0);
    expect(result.size).toBe(0);
  });

  test("calls coverage once across pages and only returns pages with rows", () => {
    let calls = 0;
    let text = "";
    const doc = document([
      element("one", { label: "⑪" }),
      element("two", { label: "波" }, "p2"),
    ]);
    const result = glyphRowsByPage(doc, (value) => {
      calls++;
      text = value;
      return { missing: [0x6ce2] };
    });
    expect(calls).toBe(1);
    expect(text).toBe("⑪\n波");
    expect([...result]).toEqual([
      ["p2", [{ elementId: "two", codePoints: [0x6ce2] }]],
    ]);
    expect(glyphRowsByPage(doc, () => undefined).size).toBe(0);
    expect(glyphRowsByPage(doc, () => ({ missing: [] })).size).toBe(0);
  });

  test("formats code points and caps messages at sixteen", () => {
    expect(glyphMissingMessage([0x246a, 0x301c])).toBe(
      "no export font has U+246A, U+301C; add a font with --font-dir",
    );
    expect(glyphMissingMessage([0xf0000])).toBe(
      "no export font has U+F0000; add a font with --font-dir",
    );
    expect(glyphMissingMessage(Array.from({ length: 19 }, (_, i) => i))).toBe(
      "no export font has U+0000, U+0001, U+0002, U+0003, U+0004, U+0005, U+0006, U+0007, U+0008, U+0009, U+000A, U+000B, U+000C, U+000D, U+000E, U+000F, and 3 more; add a font with --font-dir",
    );
  });
});
