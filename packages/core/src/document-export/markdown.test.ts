import { expect, test } from "bun:test";
import { document, element, makeEditor } from "../test-helpers.ts";
import { exportMarkdownDocument } from "./markdown.ts";
test("emits snippets and deterministic grouped assets", () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "md",
        type: "text.markdown",
        semantic: { markdown: "hello\n" },
        visual: { x: 0, y: 0, width: 100, height: 20 },
      }),
      element({
        id: "shape",
        type: "node.generic",
        semantic: { label: "Shape" },
        visual: { x: 0, y: 40, width: 100, height: 30 },
      }),
      element({
        id: "code",
        type: "text.code",
        semantic: { code: "```", language: "plain" },
        visual: { x: 0, y: 90, width: 100, height: 20 },
      }),
    ]),
  });
  const result = exportMarkdownDocument(editor, { assetDir: "doc.assets" });
  expect(result.markdown).toContain(
    "hello\n\n![Diagram page-1-1](doc.assets/page-1-1.svg)",
  );
  expect(result.markdown).toContain("````\n```\n````");
  expect(result.assets).toHaveLength(1);
  expect(exportMarkdownDocument(editor, { assetDir: "doc.assets" })).toEqual(
    result,
  );
  const embedded = exportMarkdownDocument(editor, {
    assetDir: "x",
    embed: true,
  });
  expect(embedded.assets).toEqual([]);
  expect(embedded.markdown).toContain("data:image/svg+xml;base64,");
});

test("overlapping page frames emit members once and exclude page envelopes", () => {
  const frame = (id: string, x: number) =>
    element({
      id,
      type: "frame",
      semantic: { name: id, page: { size: "a4", orientation: "portrait" } },
      visual: { x, y: 0, width: 200, height: 200 },
    });
  const editor = makeEditor({
    document: document([
      frame("first", 0),
      frame("second", 100),
      element({
        id: "markdown",
        type: "text.markdown",
        semantic: { markdown: "unique text" },
        visual: { x: 130, y: 30, width: 40, height: 20 },
      }),
      element({
        id: "shape",
        type: "node.generic",
        semantic: { label: "diagram" },
        visual: { x: 130, y: 80, width: 40, height: 20 },
      }),
    ]),
  });
  const result = exportMarkdownDocument(editor, { assetDir: "assets" });
  expect(result.markdown.match(/unique text/g)).toHaveLength(1);
  expect(result.assets).toHaveLength(1);
  expect(result.assets[0].svg).not.toContain('data-id="first"');
  expect(result.assets[0].svg).not.toContain('data-id="second"');
});

test("group members appear only once in a grouped asset", () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "group",
        type: "group",
        semantic: { memberIds: ["child"] },
      }),
      element({
        id: "child",
        type: "node.generic",
        semantic: { label: "Unique child" },
        visual: { x: 20, y: 20, width: 100, height: 50 },
      }),
    ]),
  });
  const result = exportMarkdownDocument(editor, { assetDir: "assets" });
  expect(result.assets).toHaveLength(1);
  expect(result.assets[0].svg.match(/data-id="child"/g)).toHaveLength(1);
});

test("snippet-only frames preserve tab order without assets", () => {
  const pages = [
    { id: "p1", name: "First", kind: "freeform" as const },
    { id: "p2", name: "Second", kind: "freeform" as const },
  ];
  const frame = (page: string) =>
    element({
      id: `frame-${page}`,
      page,
      type: "frame",
      semantic: { name: page, page: { size: "a4", orientation: "portrait" } },
      visual: { x: 0, y: 0, width: 200, height: 200 },
    });
  const editor = makeEditor({
    document: document(
      [
        frame("p1"),
        frame("p2"),
        element({
          id: "first",
          page: "p1",
          type: "text.markdown",
          semantic: { markdown: "first" },
          visual: { x: 10, y: 10, width: 50, height: 20 },
        }),
        element({
          id: "second",
          page: "p2",
          type: "text.code",
          semantic: { code: "second", language: "typescript" },
          visual: { x: 10, y: 10, width: 50, height: 20 },
        }),
      ],
      pages,
    ),
  });
  const result = exportMarkdownDocument(editor, { assetDir: "assets" });
  expect(result.markdown).toBe("first\n\n```typescript\nsecond\n```\n");
  expect(result.assets).toEqual([]);
});

test("groups two shapes and their connector between snippets without the page frame", () => {
  const editor = makeEditor({
    document: document([
      element({
        id: "frame",
        type: "frame",
        semantic: {
          name: "Page",
          page: { size: "a4", orientation: "portrait" },
        },
        visual: { x: 0, y: 0, width: 400, height: 400 },
      }),
      element({
        id: "md",
        type: "text.markdown",
        semantic: { markdown: "before" },
        visual: { x: 10, y: 10, width: 60, height: 20 },
      }),
      element({
        id: "shape-a",
        type: "shape.geo",
        semantic: { geo: "rect" },
        visual: { x: 30, y: 80, width: 60, height: 40 },
      }),
      element({
        id: "shape-b",
        type: "shape.geo",
        semantic: { geo: "rect" },
        visual: { x: 200, y: 80, width: 60, height: 40 },
      }),
      element({
        id: "connector",
        type: "edge.generic",
        semantic: { from: "shape-a", to: "shape-b" },
        visual: {},
      }),
      element({
        id: "code",
        type: "text.code",
        semantic: { code: "after", language: "plain" },
        visual: { x: 10, y: 250, width: 60, height: 20 },
      }),
    ]),
  });
  const result = exportMarkdownDocument(editor, { assetDir: "doc.assets" });
  expect(result.markdown).toBe(
    "before\n\n![Diagram page-1-1](doc.assets/page-1-1.svg)\n\n```\nafter\n```\n",
  );
  expect(result.assets).toHaveLength(1);
  const svg = result.assets[0].svg;
  for (const id of ["shape-a", "shape-b", "connector"])
    expect(svg.match(new RegExp(`data-id="${id}"`, "g"))).toHaveLength(1);
  for (const id of ["frame", "md", "code"])
    expect(svg).not.toContain(`data-id="${id}"`);
  expect(svg).not.toContain("before");
  expect(svg).not.toContain("after");
});
