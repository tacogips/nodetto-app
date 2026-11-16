import { expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import { exportD2 } from "./d2/export.ts";
import { exportDrawio } from "./drawio/export.ts";
import { exportMermaid } from "./mermaid/export.ts";

const snippets: Element[] = [
  {
    id: "code",
    index: "a1",
    page: "page",
    type: "text.code",
    semantic: { code: "a<b", language: "rust" },
    visual: { x: 0, y: 0, width: 100, height: 80 },
  },
  {
    id: "markdown",
    index: "a2",
    page: "page",
    type: "text.markdown",
    semantic: { markdown: "Markdown source" },
    visual: { x: 0, y: 0, width: 100, height: 80 },
  },
];
const doc: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Fallbacks",
  pages: [{ id: "page", name: "Page", kind: "freeform" }],
  elements: snippets,
};

test("draw.io exports snippet sources as text vertices", () => {
  const { xml } = exportDrawio(doc);
  expect(xml).toContain("a&amp;lt;b");
  expect(xml).toContain("fontFamily=Courier New");
  expect(xml).toContain("Markdown source");
  expect((xml.match(/vertex="1"/g) ?? []).length).toBe(2);
});

test("D2 exports both sources as text shapes", () => {
  const { code } = exportD2(doc, "page");
  expect(code).toContain('n_code: "a<b"');
  expect(code).toContain('n_markdown: "Markdown source"');
  expect((code.match(/shape: text/g) ?? []).length).toBe(2);
});

test("Mermaid omits snippets without throwing", () => {
  const { code } = exportMermaid(doc, "page", "flowchart");
  expect(code).not.toContain("a<b");
  expect(code).not.toContain("Markdown source");
});
