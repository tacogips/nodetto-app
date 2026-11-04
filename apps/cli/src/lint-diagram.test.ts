import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import {
  TEXT_LAYOUT_PAGE_ID,
  textLayoutProblemDocument,
} from "./__fixtures__/text-layout.ts";
import {
  diagramLintApplies,
  formatFixLines,
  lintDiagramPages,
} from "./lint-diagram.ts";

function tables(x: number, width = 100) {
  const editor = new Editor();
  editor.apply(
    [0, x].map((position, i) => ({
      type: "createElement" as const,
      element: editor.buildElement("erd.table", {
        id: i ? "orders" : "items",
        visual: { x: position, y: 0, width: i ? width : 100, height: 100 },
        semantic: { tableName: i ? "orders" : "items", columns: [] },
      }),
    })),
  );
  const document = editor.getSnapshot();
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      kind: "erd" as const,
      name: "Schema",
    })),
  };
}
test("overlaps include coincident and contained tables but exclude touching", () => {
  const io = { readText: () => "", writeText: () => {} };
  for (const doc of [tables(0), tables(20, 40)]) {
    expect(diagramLintApplies(doc, doc.pages[0]!)).toBe(true);
    const rows = lintDiagramPages(io, "doc.jsonl", doc, { fix: false }).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      severity: "warning",
      ruleId: "node-overlap",
    });
    expect(rows[0]?.message).toContain('on page "Schema"');
    expect(rows[0]?.message).toContain("orders");
    expect(rows[0]?.message).toContain("items");
  }
  expect(
    lintDiagramPages(io, "doc.jsonl", tables(100), { fix: false }).rows,
  ).toHaveLength(0);
});
test("image checks use the attachment seam and stable reasons", () => {
  const editor = new Editor();
  const add = (id: string, src: string) =>
    editor.buildElement("image.raster", {
      id,
      semantic: { src, alt: "Image" },
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
  editor.apply(
    [
      add("missing", "assets/missing.png"),
      add("good", "assets/good.png"),
      add("embedded", "data:image/png;base64,iVBORw0KGgo="),
    ].map((element) => ({ type: "createElement" as const, element })),
  );
  const doc = editor.getSnapshot();
  expect(diagramLintApplies(doc, doc.pages[0]!)).toBe(true);
  const io = {
    readText: () => "",
    writeText: () => {},
    exists: (path: string) => path !== "dir/assets/missing.png",
    readAttachment: () => new Uint8Array(),
  };
  expect(
    lintDiagramPages(io, "dir/doc.jsonl", doc, { fix: false }).rows.map(
      (r) => r.message,
    ),
  ).toEqual(['image src "assets/missing.png" file not found']);
  const unreadable = {
    ...io,
    exists: () => true,
    readAttachment: () => {
      throw new Error("host detail");
    },
  };
  expect(
    lintDiagramPages(unreadable, "dir/doc.jsonl", doc, { fix: false }).rows.map(
      (r) => r.message,
    ),
  ).toEqual([
    'image src "assets/good.png" cannot be read (outside the document folder, too large, or unreadable)',
    'image src "assets/missing.png" cannot be read (outside the document folder, too large, or unreadable)',
  ]);
  expect(
    lintDiagramPages(
      { readText: io.readText, writeText: io.writeText },
      "doc",
      doc,
      { fix: false },
    ).rows,
  ).toEqual([]);
  const empty = new Editor().getSnapshot();
  expect(diagramLintApplies(empty, empty.pages[0]!)).toBe(false);
});
test("fix writes once and rejects BPMN", () => {
  let source = textLayoutProblemDocument("flowchart");
  let writes = 0;
  const io = {
    readText: () => source,
    writeText: (_path: string, text: string) => {
      source = text;
      writes++;
    },
  };
  const first = lintDiagramPages(io, "doc.jsonl", parseDocument(source), {
    fix: true,
    textLayoutPageIds: [TEXT_LAYOUT_PAGE_ID],
  });
  expect(first.written).toBe(true);
  expect(first.fixes.length).toBeGreaterThan(0);
  expect(first.fixes[0]?.before).not.toBe(first.fixes[0]?.after);
  expect(formatFixLines(first.fixes)).toContain("line break(s)");
  const saved = source;
  const second = lintDiagramPages(io, "doc.jsonl", parseDocument(source), {
    fix: true,
    textLayoutPageIds: [TEXT_LAYOUT_PAGE_ID],
  });
  expect(second.written).toBe(false);
  expect(source).toBe(saved);
  expect(writes).toBe(1);
  expect(
    lintDiagramPages(io, "doc.bpmn", parseDocument(source), { fix: true })
      .error,
  ).toBe("--fix needs a nodetto document");
  expect(writes).toBe(1);
  expect(serializeDocument(parseDocument(source))).toBe(source);
});
