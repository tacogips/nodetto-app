import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import {
  TEXT_LAYOUT_PAGE_ID,
  textLayoutProblemDocument,
} from "./__fixtures__/text-layout.ts";
import { readLocalAttachment } from "./attachments.ts";
import {
  diagramLintApplies,
  documentRelativePath,
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

test("wrap and label fixes are atomic and repeat without writes", () => {
  let source = textLayoutProblemDocument("architecture");
  let writes = 0;
  const io = {
    readText: () => source,
    writeText: (_path: string, text: string) => {
      source = text;
      writes++;
    },
  };
  const options = { fix: true, textLayoutPageIds: [TEXT_LAYOUT_PAGE_ID] };
  const first = lintDiagramPages(
    io,
    "doc.jsonl",
    parseDocument(source),
    options,
  );
  expect(first.error).toBeUndefined();
  expect(formatFixLines(first.fixes)).toContain("line break(s)");
  expect(formatFixLines(first.fixes)).toContain("moved label");
  expect(writes).toBe(1);
  const second = lintDiagramPages(
    io,
    "doc.jsonl",
    parseDocument(source),
    options,
  );
  expect(second.fixes).toHaveLength(0);
  expect(writes).toBe(1);
});

test("failed combined label batch saves neither label nor wrap fixes", () => {
  const source = textLayoutProblemDocument("architecture");
  let reads = 0;
  let writes = 0;
  const io = {
    readText: () => (++reads === 1 ? source : "invalid"),
    writeText: () => {
      writes++;
    },
  };
  const result = lintDiagramPages(io, "doc.jsonl", parseDocument(source), {
    fix: true,
    textLayoutPageIds: [TEXT_LAYOUT_PAGE_ID],
  });
  expect(formatFixLines(result.fixes)).toContain("moved label");
  expect(result.error).toBeDefined();
  expect(result.written).toBe(false);
  expect(writes).toBe(0);
});

test("document relative paths normalize directory segments", () => {
  const cases = [
    ["a/b/../doc.jsonl", "img/x.png", "a/img/x.png"],
    ["./doc.jsonl", "x.png", "x.png"],
    ["doc.jsonl", "x.png", "x.png"],
    ["../x/doc.jsonl", "y.png", "../x/y.png"],
    ["/abs/doc.jsonl", "y.png", "/abs/y.png"],
    ["a//b/./doc.jsonl", "y.png", "a/b/y.png"],
    ["/../../doc.jsonl", "x.png", "/x.png"],
    ["../../doc.jsonl", "x.png", "../../x.png"],
  ];
  for (const [documentPath, src, expected] of cases) {
    expect(documentRelativePath(documentPath!, src!)).toBe(expected);
  }
});

test("image checks normalize document paths and reject symlink escapes", () => {
  const root = mkdtempSync(join(tmpdir(), "nodetto-image-lint-"));
  try {
    const directory = join(root, "document");
    mkdirSync(join(directory, "assets"), { recursive: true });
    writeFileSync(join(directory, "assets", "good.png"), "image");
    writeFileSync(join(root, "outside.png"), "image");
    symlinkSync(
      join(root, "outside.png"),
      join(directory, "assets", "link.png"),
    );
    const editor = new Editor();
    editor.apply(
      ["good", "missing", "link"].map((name) => ({
        type: "createElement" as const,
        element: editor.buildElement("image.raster", {
          id: name,
          semantic: { src: `assets/${name}.png`, alt: "Image" },
          visual: { x: 0, y: 0, width: 100, height: 100 },
        }),
      })),
    );
    const io = {
      readText: () => "",
      writeText: () => {},
      exists: existsSync,
      readAttachment: readLocalAttachment,
    };
    const paths = [
      `${relative(process.cwd(), root)}/document/../document/doc.jsonl`,
      `${directory}/./doc.jsonl`,
    ];
    for (const path of paths) {
      expect(
        lintDiagramPages(io, path, editor.getSnapshot(), {
          fix: false,
        }).rows.map((row) => row.message),
      ).toEqual([
        'image src "assets/link.png" cannot be read (outside the document folder, too large, or unreadable)',
        'image src "assets/missing.png" file not found',
      ]);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ERD frame straddles are warning rows in text and JSON", async () => {
  const { document, element } = await import(
    "../../../packages/core/src/test-helpers.ts"
  );
  const { runCli } = await import("./commands.ts");
  const frame = element({
    id: "frame",
    type: "frame",
    semantic: { name: "zone" },
    visual: { x: 0, y: 0, width: 200, height: 100 },
  });
  const table = element({
    id: "table",
    type: "erd.table",
    semantic: { tableName: "widgets", columns: [] },
    visual: { x: 180, y: 10, width: 100 },
  });
  const doc = document(
    [frame, table],
    [{ id: "page-1", name: "Schema", kind: "erd" }],
  );
  const io = { readText: () => serializeDocument(doc), writeText: () => {} };
  const text = runCli(["lint", "doc"], io, "t");
  expect(text.exitCode).toBe(0);
  expect(text.stdout).toContain("widgets");
  expect(text.stdout).toContain("zone");
  const json = runCli(["lint", "doc", "--format", "json"], io, "t");
  expect(json.exitCode).toBe(0);
  expect(json.stdout).toContain('"frame-straddle"');
  expect(json.stdout).toContain('"warning"');
  const inside = {
    ...doc,
    elements: [frame, { ...table, visual: { ...table.visual, x: 10 } }],
  };
  expect(
    lintDiagramPages(io, "doc", inside, { fix: false }).rows.filter(
      (row) => row.ruleId === "frame-straddle",
    ),
  ).toEqual([]);
});
