import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { documentPdfPlan, Editor, extractPdfText } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { exportCommand } from "./export-command.ts";
import { localIo } from "./local-io.ts";
import { Batch } from "./edit/batch.ts";

test("registered code snippets are authored through the edit pipeline", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  batch.apply(
    { op: "add", type: "text.code", id: "code1", semantic: { language: "TS" } },
    0,
  );
  batch.apply({ op: "add", type: "text.code", id: "code2" }, 1);
  expect(editor.store.get("code1")?.semantic).toMatchObject({
    language: "javascript",
    code: "",
  });
  expect(editor.store.get("code2")?.semantic).toMatchObject({
    language: "plain",
    code: "",
  });
  expect(() =>
    batch.apply(
      {
        op: "add",
        type: "text.code",
        id: "code3",
        semantic: { language: "klingon" },
      },
      2,
    ),
  ).toThrow('Unknown language "klingon"');
  batch.dispose();
});

const fixture = join(
  import.meta.dir,
  "../../../packages/io/src/__fixtures__/document-pages.jsonl",
);

test("CLI SVG and document PDF match the editor and document plan", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nodetto-wiring-"));
  try {
    const editor = new Editor({
      document: parseDocument(await readFile(fixture, "utf8")),
    });
    const svg = await exportCommand(localIo(), [
      fixture,
      "--format",
      "svg",
      "--page",
      "p1",
    ]);
    expect(svg.exitCode).toBe(0);
    const expectedSvg = editor.exportPageSvgOf("p1", {
      padding: 16,
      background: null,
      prototypeView: false,
    });
    if (expectedSvg === null) throw new Error("fixture has no visible SVG");
    expect(svg.stdout).toBe(expectedSvg);
    const pdf = join(dir, "doc.pdf");
    const result = await exportCommand(localIo(), [
      fixture,
      "--format",
      "pdf",
      "--document",
      "--output",
      pdf,
    ]);
    expect(result.exitCode).toBe(0);
    const pages = (await extractPdfText(await readFile(pdf))).pages;
    const expected = documentPdfPlan(editor, { background: "#ffffff" }).map(
      (page) => page.spec.textRuns.map((run) => run.text).join("\n"),
    );
    expect(pages).toHaveLength(3);
    expect(pages).toEqual(expected);
    expect(expected.some((text) => text.includes("日本語"))).toBe(true);
    expect(expected.some((text) => text.includes("太字"))).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI Markdown preserves snippets and groups adjacent shapes into one asset", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nodetto-markdown-"));
  try {
    const editor = new Editor();
    const markdown = "# Heading\n\nVerbatim **text**";
    editor.createElement("text.markdown", {
      semantic: { markdown },
      visual: { x: 0, y: 0, width: 300, height: 100 },
    });
    for (const x of [0, 150])
      editor.createElement("shape.geo", {
        semantic: { geo: "rect", label: "shape" },
        visual: { x, y: 150, width: 100, height: 80 },
      });
    editor.createElement("text.code", {
      semantic: { language: "rust", code: "fn main() {}" },
      visual: { x: 0, y: 300, width: 300, height: 100 },
    });
    const input = join(dir, "in.jsonl");
    await writeFile(input, serializeDocument(editor.getSnapshot()));
    const output = join(dir, "doc.md");
    expect(
      (
        await exportCommand(localIo(), [
          input,
          "--format",
          "markdown",
          "--output",
          output,
        ])
      ).exitCode,
    ).toBe(0);
    const text = await readFile(output, "utf8");
    expect(text).toContain(markdown);
    expect(text.match(/^```rust$/gm)).toHaveLength(1);
    expect(await readdir(join(dir, "doc.assets"))).toEqual(["page-1-1.svg"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
