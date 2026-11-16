import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localIo } from "./local-io.ts";
import { expect, test } from "bun:test";
import { Editor, extractPdfText } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { exportCommand } from "./export-command.ts";
import type { CommandIo } from "./commands.ts";
test("document export validates conflicts and markdown forms match", async () => {
  const editor = new Editor();
  editor.createElement("node.generic", {
    semantic: { label: "Shape" },
    visual: { x: 0, y: 0, width: 100, height: 50 },
  });
  const files = new Map<string, string>();
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: (path, text) => {
      files.set(path, text);
    },
    ensureDir: async () => {},
  };
  expect(
    (
      await exportCommand(io, [
        "in",
        "--format",
        "svg",
        "--document",
        "--output",
        "x",
      ])
    ).exitCode,
  ).toBe(2);
  expect(
    (
      await exportCommand(io, [
        "in",
        "--format",
        "markdown",
        "--document",
        "--page",
        "p",
        "--output",
        "x.md",
      ])
    ).exitCode,
  ).toBe(2);
  expect(
    (
      await exportCommand(io, [
        "in",
        "--format",
        "markdown",
        "--output",
        "a/doc.md",
      ])
    ).exitCode,
  ).toBe(0);
  expect(
    (
      await exportCommand(io, [
        "in",
        "--format",
        "markdown",
        "--document",
        "--output",
        "b/doc.md",
      ])
    ).exitCode,
  ).toBe(0);
  expect(files.get("a/doc.md")).toBe(files.get("b/doc.md"));
  expect(files.get("a/doc.assets/page-1-1.svg")).toBe(
    files.get("b/doc.assets/page-1-1.svg"),
  );
});

test("missing directory host fails before writing markdown", async () => {
  const editor = new Editor();
  editor.createElement("node.generic", {
    semantic: { label: "Shape" },
    visual: { x: 0, y: 0, width: 100, height: 50 },
  });
  const writes: string[] = [];
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: (path) => {
      writes.push(path);
    },
  };
  const result = await exportCommand(io, [
    "in",
    "--format",
    "markdown",
    "--output",
    "doc.md",
  ]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("This host cannot create directories.");
  expect(writes).toEqual([]);
});

test("writes markdown assets into a new nested directory and reruns", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nodetto-export-"));
  try {
    const editor = new Editor();
    editor.createElement("node.generic", {
      semantic: { label: "Shape" },
      visual: { x: 0, y: 0, width: 100, height: 50 },
    });
    const input = join(dir, "in.jsonl");
    await writeFile(input, serializeDocument(editor.getSnapshot()));
    const target = join(dir, "out", "doc.md");
    for (let i = 0; i < 2; i++)
      expect(
        (
          await exportCommand(localIo(), [
            input,
            "--format",
            "markdown",
            "--output",
            target,
          ])
        ).exitCode,
      ).toBe(0);
    expect(await readFile(target, "utf8")).toContain("doc.assets/page-1-1.svg");
    expect(
      await readFile(join(dir, "out", "doc.assets", "page-1-1.svg"), "utf8"),
    ).toContain("<svg");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("exports one PDF page per document frame", async () => {
  const editor = new Editor();
  for (let i = 0; i < 2; i++)
    editor.createElement("frame", {
      semantic: {
        name: `Page ${i}`,
        page: { size: "a4", orientation: "portrait" },
      },
      visual: { x: i * 200, y: 0, width: 100, height: 120 },
    });
  let output = new Uint8Array();
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: () => {},
    writeBytes: (_path, bytes) => {
      output = bytes;
    },
  };
  const result = await exportCommand(io, [
    "in",
    "--format",
    "pdf",
    "--document",
    "--output",
    "out.pdf",
  ]);
  expect(result.exitCode).toBe(0);
  expect((await extractPdfText(output)).pages).toHaveLength(2);
});

test("document exports reject every scoped option conflict", async () => {
  const editor = new Editor();
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: () => {},
  };
  for (const flag of [
    "--page",
    "--element",
    "--frames",
    "--pdf-page",
    "--orientation",
    "--margin",
  ]) {
    const option = flag === "--frames" ? [flag] : [flag, "value"];
    for (const format of ["pdf", "markdown"]) {
      const result = await exportCommand(io, [
        "in",
        "--format",
        format,
        "--document",
        "--output",
        `out.${format === "pdf" ? "pdf" : "md"}`,
        ...option,
      ]);
      expect(result.exitCode).toBe(2);
    }
  }
});
test("asset-free page frames do not create a directory", async () => {
  const editor = new Editor();
  editor.createElement("frame", {
    semantic: { name: "Page", page: { size: "a4", orientation: "portrait" } },
    visual: { x: 0, y: 0, width: 100, height: 120 },
  });
  const writes: string[] = [];
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: (path) => {
      writes.push(path);
    },
    ensureDir: async () => {
      throw new Error("unexpected directory");
    },
  };
  const result = await exportCommand(io, [
    "in",
    "--format",
    "markdown",
    "--output",
    "doc.md",
  ]);
  expect(result.exitCode).toBe(0);
  expect(writes).toEqual(["doc.md"]);
});

test("document PDF resolves image attachments before rasterization", async () => {
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src: "artifacts/icon.png", alt: "Icon" },
    visual: { x: 0, y: 0, width: 20, height: 20 },
  });
  const reads: string[] = [];
  let svg = "";
  let written = false;
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    readAttachment: (document, source) => {
      reads.push(`${document}:${source}`);
      return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    },
    writeText: () => {},
    writeBytes: () => {
      written = true;
    },
  };
  const result = await exportCommand(
    io,
    ["input.jsonl", "--format", "pdf", "--document", "--output", "out.pdf"],
    {
      rasterize: async (source) => {
        svg = source;
        return new Uint8Array([1]);
      },
      pngToPdf: async () => {
        throw new Error("unexpected single-page path");
      },
      pagesToPdf: async (pages) => {
        expect(pages).toHaveLength(1);
        return new Uint8Array([2]);
      },
    },
  );
  expect(result.exitCode).toBe(0);
  expect(reads).toEqual(["input.jsonl:artifacts/icon.png"]);
  expect(svg).toContain("data:image/png;base64,iVBORw0KGgo=");
  expect(written).toBe(true);
});
