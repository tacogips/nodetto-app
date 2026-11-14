import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareFractional, Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import {
  binary,
  cliEntry,
  cliSrcDir,
  compare,
  decodeRgbaPng,
  fixtureRoot,
  nativeTest,
} from "./harness.ts";

function document(
  label: string,
  style: {
    fontSize?: number;
    fontFamily?: string;
    letterSpacing?: number;
  } = {},
): string {
  const editor = new Editor();
  editor.setPageKind(editor.currentPageId, "sequence");
  editor.createElement("sequence.participant", {
    id: "a",
    semantic: { name: "Widget", kind: "service", order: "a1" },
    visual: { x: 0, y: 0, width: 160, height: 300 },
  });
  editor.createElement("sequence.message", {
    id: "m",
    semantic: { from: "a", to: "a", order: "b1", kind: "sync", label },
    visual: { y: 120, style },
  });
  return serializeDocument(editor.getSnapshot());
}

nativeTest(
  "native self-connect kinds and SVG match Bun bytes",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-self-parity-"));
    try {
      const editor = new Editor();
      editor.setPageKind(editor.currentPageId, "sequence");
      editor.createElement("sequence.participant", {
        id: "a",
        semantic: { name: "Widget", kind: "service", order: "a1" },
      });
      const bunDoc = join(dir, "bun.jsonl");
      const nativeDoc = join(dir, "native.jsonl");
      const ops = join(dir, "ops.json");
      writeFileSync(
        ops,
        JSON.stringify([
          { op: "select", id: "a", ref: "a" },
          ...["sync", "async", "return"].map((kind) => ({
            op: "connect",
            from: "@a",
            to: "@a",
            label: "check",
            semantic: { kind },
          })),
        ]),
      );
      const source = serializeDocument(editor.getSnapshot());
      writeFileSync(bunDoc, source);
      writeFileSync(nativeDoc, source);
      const bun = Bun.spawnSync([
        process.execPath,
        cliEntry,
        "edit",
        bunDoc,
        "--ops",
        ops,
        "--quiet",
      ]);
      const native = Bun.spawnSync([
        binary!,
        "edit",
        nativeDoc,
        "--ops",
        ops,
        "--quiet",
      ]);
      expect(bun.exitCode).toBe(0);
      expect(native.exitCode).toBe(0);
      const normalize = (text: string, path: string) =>
        text
          .replaceAll(path, "<document>")
          .replace(/[0-9A-HJKMNP-TV-Z]{26}/g, "<id>");
      expect(normalize(native.stdout.toString(), nativeDoc)).toBe(
        normalize(bun.stdout.toString(), bunDoc),
      );
      expect(native.stderr.toString()).toBe(bun.stderr.toString());

      type Record = {
        kind: string;
        type?: string;
        semantic?: {
          order: string;
          from: string;
          to: string;
          label: string;
          kind: string;
        };
        visual?: unknown;
      };
      const records = (path: string): Record[] =>
        readFileSync(path, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as Record);
      const bunRecords = records(bunDoc);
      const nativeRecords = records(nativeDoc);
      const messages = (items: Record[]) =>
        items
          .filter(
            (item) =>
              item.kind === "element" && item.type === "sequence.message",
          )
          .sort((a, b) =>
            compareFractional(a.semantic!.order, b.semantic!.order),
          );
      const bunMessages = messages(bunRecords);
      const nativeMessages = messages(nativeRecords);
      expect(bunMessages).toHaveLength(3);
      expect(nativeMessages).toHaveLength(3);
      const properties = (items: Record[]) =>
        items.map((item) => ({
          from: item.semantic!.from,
          to: item.semantic!.to,
          label: item.semantic!.label,
          kind: item.semantic!.kind,
          visual: item.visual,
        }));
      expect(properties(nativeMessages)).toEqual(properties(bunMessages));
      expect(
        bunMessages.map((item) => [
          item.semantic!.kind,
          item.semantic!.from,
          item.semantic!.to,
          item.semantic!.label,
        ]),
      ).toEqual(
        ["sync", "async", "return"].map((kind) => [kind, "a", "a", "check"]),
      );
      expect(
        nativeRecords.find((item) => item.type === "sequence.participant")
          ?.visual,
      ).toEqual(
        bunRecords.find((item) => item.type === "sequence.participant")?.visual,
      );
      const bunSvg = compare(["export", bunDoc, "--format", "svg"]);
      const nativeSvg = compare(["export", nativeDoc, "--format", "svg"]);
      expect(bunSvg.exitCode).toBe(0);
      expect(nativeSvg.exitCode).toBe(0);
      const points = (svg: string) =>
        Array.from(
          svg.matchAll(/<polyline\b[^>]*\bpoints="([^"]*)"/g),
          (match) => match[1],
        );
      expect(points(bunSvg.stdout.toString())).toHaveLength(3);
      expect(points(nativeSvg.stdout.toString())).toEqual(
        points(bunSvg.stdout.toString()),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  30000,
);

for (const [input, expected] of [
  [join(fixtureRoot, "sequence.jsonl"), "io-sequence.expected.svg"],
  [
    join(cliSrcDir, "__fixtures__/sequence-golden/omitted-geometry.jsonl"),
    "omitted-geometry.expected.svg",
  ],
]) {
  nativeTest(
    `native reproduces golden ${expected}`,
    () => {
      const result = Bun.spawnSync([
        binary!,
        "export",
        input,
        "--format",
        "svg",
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toEqual(
        readFileSync(join(cliSrcDir, "__fixtures__/sequence-golden", expected)),
      );
    },
    30000,
  );
}

for (const [name, label, style] of [
  ["wide glyphs", "W".repeat(26), { fontSize: 11 }],
  ["letter spacing", "W".repeat(6), { letterSpacing: 20 }],
] as const) {
  nativeTest(
    `native PNG contains self-message ${name}`,
    () => {
      const dir = mkdtempSync(join(tmpdir(), "nodetto-self-png-"));
      try {
        const doc = join(dir, "doc.jsonl");
        const png = join(dir, "out.png");
        writeFileSync(doc, document(label, style));
        const svg = compare(["export", doc, "--format", "svg"]);
        expect(svg.exitCode).toBe(0);
        const match = /viewBox="([^\"]+)"/.exec(svg.stdout.toString());
        if (!match?.[1]) throw new Error("missing viewBox");
        const [left, top, width] = match[1].split(" ").map(Number);
        if (left === undefined || top === undefined || width === undefined)
          throw new Error("invalid viewBox");
        const result = Bun.spawnSync([
          binary!,
          "export",
          doc,
          "--format",
          "png",
          "--output",
          png,
        ]);
        expect(result.exitCode).toBe(0);
        const image = decodeRgbaPng(readFileSync(png));
        const scale = image.width / width;
        const pixel = (x: number, y: number, c: number) =>
          image.pixels[(y * image.width + x) * 4 + c] ?? 255;
        const legX = Math.round((120 - left) * scale);
        const legY = Math.round((136 - top) * scale);
        let leg = false;
        for (
          let y = Math.max(0, legY - 2);
          y <= Math.min(image.height - 1, legY + 2);
          y++
        )
          for (
            let x = Math.max(0, legX - 2);
            x <= Math.min(image.width - 1, legX + 2);
            x++
          )
            if (
              pixel(x, y, 0) <= 0xc0 &&
              pixel(x, y, 1) <= 0xc0 &&
              pixel(x, y, 2) <= 0xc0
            )
              leg = true;
        expect(leg).toBe(true);
        let glyph = false;
        for (
          let y = Math.max(0, Math.floor((120 - top) * scale));
          y < Math.min(image.height, Math.ceil((152 - top) * scale));
          y++
        )
          for (
            let x = Math.max(0, Math.ceil((128 - left) * scale));
            x < image.width - 2;
            x++
          )
            if (
              pixel(x, y, 0) <= 0xc0 ||
              pixel(x, y, 1) <= 0xc0 ||
              pixel(x, y, 2) <= 0xc0
            )
              glyph = true;
        expect(glyph).toBe(true);
        for (let y = 0; y < image.height; y++)
          for (let x = image.width - 2; x < image.width; x++)
            for (let c = 0; c < 3; c++)
              expect(pixel(x, y, c)).toBe(pixel(0, 0, c));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    30000,
  );
}

nativeTest(
  "native self-message PDF has PDF magic",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-self-pdf-"));
    try {
      const doc = join(dir, "doc.jsonl");
      const pdf = join(dir, "out.pdf");
      writeFileSync(doc, document("check"));
      const result = Bun.spawnSync([
        binary!,
        "export",
        doc,
        "--format",
        "pdf",
        "--output",
        pdf,
      ]);
      expect(result.exitCode).toBe(0);
      expect(readFileSync(pdf).subarray(0, 4).toString()).toBe("%PDF");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  30000,
);
