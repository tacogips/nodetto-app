import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { runCli, type CommandIo } from "./commands.ts";
import { exportCommand, type RasterBackend } from "./export-command.ts";
import { applyQuiet } from "./warnings.ts";

function fixture() {
  const editor = new Editor();
  const page = editor.createPage({ name: "Schema", kind: "erd" });
  const id = editor.createElement("node.generic", {
    semantic: { label: "Widget \u{F0000}" },
  });
  let calls = 0;
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: () => {},
    writeBytes: () => {},
    fontCoverage: () => {
      calls++;
      return { needsFallback: true, missing: [0xf0000] };
    },
  };
  return { io, page, id, editor, calls: () => calls };
}

test("raster export requests fallback and attributes missing glyphs, SVG bypasses coverage", async () => {
  const { io, page, id, calls } = fixture();
  const fallback: (boolean | undefined)[] = [];
  const backend: RasterBackend = {
    rasterize: async (_svg, _scale, _dir, value) => {
      fallback.push(value);
      return new Uint8Array([1]);
    },
    pngToPdf: async () => new Uint8Array([2]),
  };
  for (const format of ["png", "pdf"]) {
    const result = await exportCommand(
      io,
      [
        "doc.jsonl",
        "--page",
        page,
        "--format",
        format,
        "--output",
        `out.${format}`,
      ],
      backend,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain(
      `glyph-missing ${id}: no export font has U+F0000`,
    );
  }
  expect(fallback).toEqual([true, true]);
  const before = calls();
  const svg = await exportCommand(
    io,
    ["doc.jsonl", "--page", page, "--format", "svg"],
    backend,
  );
  expect(svg.exitCode).toBe(0);
  expect(calls()).toBe(before);
});

test("ERD glyph rows are linted without notation rules", () => {
  const { io, page, id } = fixture();
  const result = runCli(
    ["lint", "doc.jsonl", "--page", page, "--format", "json"],
    io,
    "test",
  );
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain(id);
  expect(result.stdout).toContain("glyph-missing");
  expect(result.stdout).not.toContain("label-overflow");
});

test("raster fallback is disabled for covered and unavailable coverage", async () => {
  const { io, page } = fixture();
  const fallback: (boolean | undefined)[] = [];
  const backend: RasterBackend = {
    rasterize: async (_svg, _scale, _dir, value) => {
      fallback.push(value);
      return new Uint8Array([1]);
    },
    pngToPdf: async () => new Uint8Array([2]),
  };
  const variants: CommandIo[] = [
    { ...io, fontCoverage: () => ({ needsFallback: false, missing: [] }) },
    { ...io, fontCoverage: () => undefined },
    {
      readText: io.readText,
      writeText: io.writeText,
      writeBytes: io.writeBytes,
    },
  ];
  for (const variant of variants) {
    const result = await exportCommand(
      variant,
      ["doc.jsonl", "--page", page, "--format", "png", "--output", "out.png"],
      backend,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("glyph-missing");
  }
  expect(fallback).toEqual([false, false, false]);
});

test("export keeps attribution lines separate, scopes selections, and quiet removes warnings", async () => {
  const { io, page, id, editor } = fixture();
  const second = editor.createElement("node.generic", {
    semantic: { label: "Another \u{F0000}" },
    visual: { x: 220, y: 0 },
  });
  const backend: RasterBackend = {
    rasterize: async () => new Uint8Array([1]),
    pngToPdf: async () => new Uint8Array([2]),
  };
  const args = [
    "doc.jsonl",
    "--page",
    page,
    "--format",
    "png",
    "--output",
    "out.png",
  ];
  const result = await exportCommand(io, args, backend);
  expect(result.stderr).toContain(`glyph-missing ${id}:`);
  expect(result.stderr).toContain(`glyph-missing ${second}:`);
  expect(result.stderr.match(/warning: glyph-missing/g)?.length).toBe(2);
  expect(applyQuiet("export", result).stderr).not.toContain("glyph-missing");
  const selected = await exportCommand(io, [...args, "--element", id], backend);
  expect(selected.stderr).toContain(`glyph-missing ${id}:`);
  expect(selected.stderr).not.toContain(`glyph-missing ${second}:`);
  const plain = editor.createElement("node.generic", {
    semantic: { label: "Plain widget" },
    visual: { x: 440, y: 0 },
  });
  const plainResult = await exportCommand(
    io,
    [...args, "--element", plain],
    backend,
  );
  expect(plainResult.stderr).not.toContain(`glyph-missing ${second}:`);
  expect(plainResult.stderr).toContain(`glyph-missing page ${page}:`);
  const failed = await exportCommand(io, args, {
    ...backend,
    rasterize: async () => {
      throw new Error("raster failed");
    },
  });
  expect(failed.stderr).toContain(`glyph-missing ${id}:`);
  expect(failed.stderr).toContain("Cannot export: raster failed");
  const pageOnly = await exportCommand(
    {
      ...io,
      fontCoverage: () => ({ needsFallback: false, missing: [0x301c] }),
    },
    args,
    backend,
  );
  expect(pageOnly.stderr).toContain(
    `glyph-missing page ${page}: no export font has U+301C`,
  );
});

test("glyph rows select non-lint pages without changing notation selection or empty errors", () => {
  const editor = new Editor();
  const freeform = editor.createPage({ name: "Canvas", kind: "freeform" });
  const freeformNode = editor.createElement("node.generic", {
    semantic: { label: "Canvas widget" },
    visual: { width: 20, height: 10 },
  });
  const sequencePage = editor.createPage({ name: "Schema", kind: "sequence" });
  const id = editor.createElement("node.generic", {
    semantic: { label: "Widget \u{F0000} with a long label" },
    visual: { width: 20, height: 10 },
  });
  let configReads = 0;
  const io: CommandIo = {
    readText: (path) => {
      if (path === ".bpmnlintrc") configReads++;
      return serializeDocument(editor.getSnapshot());
    },
    writeText: () => {},
    exists: () => {
      configReads++;
      return true;
    },
    fontCoverage: () => ({ needsFallback: false, missing: [0xf0000] }),
  };
  const lint = (host: CommandIo, ...args: string[]) =>
    runCli(["lint", "doc.jsonl", ...args], host, "test");
  const result = lint(io, "--format", "json");
  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout) as {
    pages: {
      pageId: string;
      findings: {
        ruleId: string;
        elementId: string;
        severity: string;
        message: string;
      }[];
    }[];
  };
  const freeformFindings = report.pages.find(
    (page) => page.pageId === freeform,
  )?.findings;
  expect(
    freeformFindings?.some(
      (finding) =>
        finding.elementId === freeformNode &&
        finding.ruleId === "label-overflow",
    ),
  ).toBe(true);
  expect(
    freeformFindings?.some((finding) => finding.ruleId === "glyph-missing"),
  ).toBe(false);
  const row = report.pages.find((page) => page.pageId === sequencePage);
  expect(row?.findings).toEqual([
    {
      elementId: id,
      severity: "warning",
      message: "no export font has U+F0000; add a font with --font-dir",
      ruleId: "glyph-missing",
    },
  ]);
  const selected = lint(io, "--page", "Schema");
  expect(selected.stdout).toContain("glyph-missing");
  expect(selected.stdout).toContain(id);
  expect(configReads).toBe(0);
  const free = lint(io, "--page", "Canvas", "--format", "json");
  expect(
    JSON.parse(free.stdout).pages.map(
      (page: { pageId: string }) => page.pageId,
    ),
  ).toEqual([freeform]);
  const covered: CommandIo = {
    ...io,
    fontCoverage: () => ({ needsFallback: false, missing: [] }),
  };
  const noRows = JSON.parse(lint(covered, "--format", "json").stdout) as {
    pages: { pageId: string; findings: typeof freeformFindings }[];
  };
  expect(
    noRows.pages.find((page) => page.pageId === freeform)?.findings,
  ).toEqual(freeformFindings);
  expect(noRows.pages.some((page) => page.pageId === sequencePage)).toBe(false);
  expect(lint(covered, "--page", "Schema").exitCode).toBe(2);
  expect(lint(covered, "--page", "Schema").stderr).not.toContain(
    "contains no BPMN",
  );
});

test("non-notation documents preserve no-pages errors unless a selected page has glyph rows", () => {
  for (const kind of ["sequence", "pcb"] as const) {
    const { io, page, editor } = fixture();
    const snapshot = editor.getSnapshot();
    const onlyPage = {
      ...snapshot,
      pages: snapshot.pages
        .filter((item) => item.id === page)
        .map((item) => ({ ...item, kind })),
    };
    const host: CommandIo = {
      ...io,
      readText: () => serializeDocument(onlyPage),
    };
    const lint = (target: CommandIo, ...args: string[]) =>
      runCli(["lint", "doc.jsonl", ...args], target, "test");
    expect(lint(host, "--page", page).exitCode).toBe(0);
    const covered: CommandIo = {
      ...host,
      fontCoverage: () => ({ needsFallback: false, missing: [] }),
    };
    for (const args of [[], ["--page", page], ["--page", "missing"]]) {
      const result = lint(covered, ...args);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Document contains no BPMN");
    }
    const missing = lint(host, "--page", "missing");
    expect(missing.exitCode).toBe(2);
    expect(missing.stderr).toContain("Document contains no BPMN");
  }
});
