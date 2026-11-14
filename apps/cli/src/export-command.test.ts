import { expect, test } from "bun:test";
import { Editor, HANDOFF_FORMATS, svgRasterDimensions } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { PDFDocument } from "pdf-lib";
import type { CommandIo } from "./commands.ts";
import { exportCommand, type RasterBackend } from "./export-command.ts";
import * as raster from "./raster-backend.ts";

function fixture() {
  const editor = new Editor();
  editor.createElement("node.generic", {
    semantic: { label: "Excluded content" },
  });
  const flow = editor.createPage({ name: "Sequence", kind: "sequence" });
  editor.createElement("sequence.participant", {
    semantic: { name: "Excluded actor", kind: "actor", order: "a0" },
  });
  const schema = editor.createPage({ name: "Schema", kind: "erd" });
  const table = editor.createElement("erd.table", {
    semantic: { tableName: "selected_users", columns: [] },
  });
  const design = editor.createPage({ name: "Design", kind: "freeform" });
  const frame = editor.createElement("frame", {
    semantic: { name: "Selected artboard", platform: "web" },
    visual: { x: 0, y: 0, width: 400, height: 300 },
  });
  editor.createElement("ui.control", {
    semantic: { control: "button", label: "Submit" },
    visual: { x: 20, y: 20, width: 100, height: 40 },
  });
  const text = new Map<string, string>();
  const bytes = new Map<string, Uint8Array>();
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: (path, content) => {
      text.set(path, content);
    },
    writeBytes: (path, content) => {
      bytes.set(path, content);
    },
  };
  return { editor, flow, schema, table, design, frame, io, text, bytes };
}

test("SVG, PNG and PDF export only the selected ERD page from a mixed document", async () => {
  const { schema, io } = fixture();
  const rendered: string[] = [];
  const backend: RasterBackend = {
    rasterize: async (svg) => {
      rendered.push(svg);
      return new Uint8Array([1]);
    },
    pngToPdf: async () => new Uint8Array([2]),
  };
  for (const format of ["svg", "png", "pdf"]) {
    for (const page of [schema, "Schema"]) {
      const result = await exportCommand(
        io,
        [
          "mixed.jsonl",
          "--format",
          format,
          "--page",
          page,
          "--output",
          `out.${format}`,
        ],
        backend,
      );
      expect(result.exitCode).toBe(0);
      const svg = format === "svg" ? undefined : rendered.at(-1);
      if (svg) {
        expect(svg).toContain("selected_users");
        expect(svg).not.toContain("Excluded");
      }
    }
  }
  const svg = await exportCommand(io, [
    "mixed.jsonl",
    "--format",
    "svg",
    "--page",
    "Schema",
  ]);
  expect(svg.stdout).toContain("selected_users");
  expect(svg.stdout).not.toContain("Excluded");
});

test("real raster backends produce a PNG and single-page PDF for a selected page", async () => {
  const { io, bytes } = fixture();
  for (const format of ["png", "pdf"]) {
    const result = await exportCommand(
      io,
      [
        "mixed.jsonl",
        "--format",
        format,
        "--page",
        "Schema",
        "--output",
        `out.${format}`,
        "--pdf-page",
        "a4",
        "--orientation",
        "landscape",
        "--margin",
        "12",
        "--scale",
        "1",
      ],
      raster,
    );
    expect(result.exitCode).toBe(0);
  }
  expect([...bytes.get("out.png")!.slice(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  const pdf = await PDFDocument.load(bytes.get("out.pdf")!);
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());
});

test("page selection rejects missing, ambiguous and mismatched queries before writing", async () => {
  const { io, editor, table, text, bytes } = fixture();
  for (const args of [
    [],
    ["--page", "missing"],
    ["--page", "Sequence", "--element", table],
  ]) {
    expect(
      (
        await exportCommand(io, [
          "mixed.jsonl",
          "--format",
          "svg",
          "--output",
          "out.svg",
          ...args,
        ])
      ).exitCode,
    ).toBe(2);
  }
  editor.createPage({ name: "Schema", kind: "erd" });
  expect(
    (
      await exportCommand(io, [
        "mixed.jsonl",
        "--format",
        "svg",
        "--page",
        "Schema",
      ])
    ).stderr,
  ).toContain("Several pages");
  expect(text.size + bytes.size).toBe(0);
});

test("Mermaid and D2 support page names, stdout and files", async () => {
  const { io, text } = fixture();
  for (const format of ["mermaid", "d2"]) {
    const args = ["mixed.jsonl", "--format", format, "--page", "Schema"];
    const result = await exportCommand(io, args);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("selected_users");
    expect(result.stdout).not.toContain("Excluded");
    expect(
      (await exportCommand(io, [...args, "--output", "out.txt"])).exitCode,
    ).toBe(0);
    expect(text.get("out.txt")).toBe(result.stdout);
  }
  const wrongKind = await exportCommand(io, [
    "mixed.jsonl",
    "--format",
    "mermaid",
    "--page",
    "Schema",
    "--mermaid-kind",
    "sequenceDiagram",
  ]);
  expect(wrongKind.exitCode).toBe(2);
  const explicit = await exportCommand(io, [
    "mixed.jsonl",
    "--format",
    "mermaid",
    "--page",
    "Sequence",
    "--mermaid-kind",
    "sequenceDiagram",
  ]);
  expect(explicit.stdout).toStartWith("sequenceDiagram");
  expect(explicit.stdout).not.toContain("selected_users");
});

test("every Code panel output is available through CLI element selection", async () => {
  const { io, frame } = fixture();
  for (const format of HANDOFF_FORMATS) {
    const result = await exportCommand(io, [
      "mixed.jsonl",
      "--format",
      "code",
      "--element",
      frame,
      "--code-format",
      format,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(result.stdout).not.toContain("Excluded");
    if (
      [
        "json",
        "manifest",
        "responsive-manifest",
        "adaptive-manifest",
        "mobile-assets",
        "accessibility-audit",
      ].includes(format)
    )
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    if (format === "html") expect(result.stdout).toContain("Submit");
    if (format === "swiftui") expect(result.stdout).toContain("import SwiftUI");
  }
  expect(
    (
      await exportCommand(io, [
        "mixed.jsonl",
        "--format",
        "code",
        "--page",
        "Design",
      ])
    ).stderr,
  ).toContain("requires --element");
});

test("HTML export includes only artboards from the chosen page", async () => {
  const { editor, io, bytes } = fixture();
  editor.createPage({ name: "Other website", kind: "freeform" });
  editor.createElement("frame", {
    semantic: { name: "Excluded website", platform: "web" },
    visual: { x: 0, y: 0, width: 400, height: 300 },
  });
  const result = await exportCommand(io, [
    "mixed.jsonl",
    "--format",
    "html",
    "--page",
    "Design",
    "--output",
    "site.zip",
  ]);
  expect(result.exitCode).toBe(0);
  const archive = new TextDecoder().decode(bytes.get("site.zip"));
  expect(archive).toContain("Selected artboard");
  expect(archive).toContain("Submit");
  expect(archive).not.toContain("Excluded website");
});

test("large-page PNG fits below half scale and explicit overview scales render", async () => {
  const { editor, io, bytes } = fixture();
  editor.createElement("text.note", {
    semantic: { text: "Distant marker" },
    visual: { x: 38000, y: 9000, width: 120, height: 60 },
  });
  for (const scale of [undefined, "0.1"]) {
    const result = await exportCommand(io, [
      "large.jsonl",
      "--page",
      "Design",
      "--format",
      "png",
      "--output",
      "overview.png",
      ...(scale ? ["--scale", scale] : []),
    ]);
    expect(result.exitCode).toBe(0);
    if (!scale) expect(result.stderr).toContain("scaled to 0.1");
    const png = bytes.get("overview.png")!;
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(header.getUint32(16)).toBeLessThanOrEqual(8192);
    expect(header.getUint32(20)).toBeLessThanOrEqual(8192);
  }
});

test("raster export snaps the frame to whole pixels so the background covers the raster", async () => {
  const { editor, io } = fixture();
  editor.createElement("shape.geo", {
    semantic: { geo: "rect", label: "" },
    // With the 400 x 300 artboard the page spans 601 x 301 units; with 16
    // padding a side, 633 x 333 units are 474.75 x 249.75 px at 0.75.
    visual: { x: 500, y: 0, width: 101, height: 301 },
  });
  let captured = "";
  const backend: RasterBackend = {
    rasterize: async (svg) => {
      captured = svg;
      return new Uint8Array([1]);
    },
    pngToPdf: async () => new Uint8Array([2]),
  };
  const result = await exportCommand(
    io,
    [
      "snap.jsonl",
      "--page",
      "Design",
      "--format",
      "png",
      "--scale",
      "0.75",
      "--output",
      "snap.png",
    ],
    backend,
  );
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toContain("475x250 px");
  // A renderer drawing at exactly 0.75 onto the 475 x 250 canvas finds the
  // frame and its background reaching the last pixel.
  const { width, height } = svgRasterDimensions(captured);
  expect(width * 0.75).toBeGreaterThan(474.99);
  expect(Math.ceil(width * 0.75)).toBe(475);
  expect(height * 0.75).toBeGreaterThan(249.99);
  const background =
    /<rect x="-16" y="-16" width="([^"]+)" height="([^"]+)" fill="#ffffff"/.exec(
      captured,
    );
  expect(Number(background?.[1]) * 0.75).toBeGreaterThanOrEqual(475);
  expect(Number(background?.[2]) * 0.75).toBeGreaterThanOrEqual(250);
});
