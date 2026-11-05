import { expect } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { buildTestFont } from "../__fixtures__/test-font.ts";
import { binary, cliEntry, compare, nativeTest } from "./harness.ts";

function document(label: string, kind: "erd" | "freeform") {
  const editor = new Editor();
  const page = editor.createPage({ name: "Widgets", kind });
  const id = editor.createElement("node.generic", {
    semantic: { label },
    visual: { x: 0, y: 0, width: 180, height: 80 },
  });
  const snapshot = editor.getSnapshot();
  return {
    source: serializeDocument({
      ...snapshot,
      pages: snapshot.pages.filter((item) => item.id === page),
      elements: snapshot.elements.filter((item) => item.page === page),
    }),
    page,
    id,
  };
}

nativeTest(
  "native and Bun agree on glyph warnings, lint, and custom fonts",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-glyph-"));
    try {
      const missing = document("Widget \u{F0000}", "erd");
      writeFileSync(join(cwd, "missing.jsonl"), missing.source);
      for (const format of ["png", "pdf"]) {
        const result = compare(
          [
            "export",
            "missing.jsonl",
            "--page",
            missing.page,
            "--format",
            format,
            "--output",
            `out.${format}`,
          ],
          cwd,
        );
        expect(result.exitCode).toBe(0);
        expect(result.stderr.toString()).toContain(
          `glyph-missing ${missing.id}:`,
        );
        expect(result.stderr.toString()).toContain("U+F0000");
      }
      for (const options of [[], ["--format", "json"]]) {
        const result = compare(
          ["lint", "missing.jsonl", "--page", missing.page, ...options],
          cwd,
        );
        expect(result.exitCode).toBe(0);
        expect(result.stdout.toString()).toContain("glyph-missing");
        expect(result.stdout.toString()).toContain(missing.id);
      }
      mkdirSync(join(cwd, "fonts"));
      writeFileSync(
        join(cwd, "fonts", "fixture.ttf"),
        buildTestFont([0xf0000]),
      );
      for (const format of ["png", "pdf"]) {
        const result = compare(
          [
            "export",
            "missing.jsonl",
            "--page",
            missing.page,
            "--font-dir",
            "fonts",
            "--format",
            format,
            "--output",
            `font.${format}`,
          ],
          cwd,
        );
        expect(result.exitCode).toBe(0);
        expect(result.stderr.toString()).not.toContain("glyph-missing");
      }
      const covered = compare(
        ["lint", "missing.jsonl", "--font-dir", "fonts"],
        cwd,
      );
      // An ERD with no glyph rows retains the existing no-pages error.
      expect(covered.exitCode).toBe(2);
      expect(covered.stderr.toString()).toContain(
        "The document contains no BPMN",
      );
      expect(covered.stderr.toString()).not.toContain("Unknown option");
      expect(covered.stdout.toString()).not.toContain("glyph-missing");
      const ascii = document("Widget", "freeform");
      writeFileSync(join(cwd, "ascii.jsonl"), ascii.source);
      const clean = compare(["lint", "ascii.jsonl", "--page", ascii.page], cwd);
      expect(clean.exitCode).toBe(0);
      expect(clean.stdout.toString()).not.toContain("glyph-missing");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  120000,
);

nativeTest(
  "macOS fallback covers circled numbers and wave dashes in both runtimes",
  () => {
    if (process.platform !== "darwin") return;
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-glyph-macos-"));
    try {
      const chars = `${Array.from({ length: 20 }, (_, i) =>
        String.fromCodePoint(0x2460 + i),
      ).join("")}\u301c\uff5e`;
      const sample = document(chars, "freeform");
      writeFileSync(join(cwd, "sample.jsonl"), sample.source);
      const lint = compare(
        ["lint", "sample.jsonl", "--page", sample.page],
        cwd,
      );
      expect(lint.exitCode).toBe(0);
      expect(lint.stdout.toString()).not.toContain("glyph-missing");
      for (const [index, label] of ["\u246a", "\u246b"].entries()) {
        const item = document(label, "freeform");
        writeFileSync(join(cwd, `${index}.jsonl`), item.source);
        for (const [name, executable] of [
          ["bun", process.execPath],
          ["native", binary!],
        ] as const) {
          const args = name === "bun" ? [cliEntry] : [];
          const result = Bun.spawnSync(
            [
              executable,
              ...args,
              "export",
              `${index}.jsonl`,
              "--page",
              item.page,
              "--format",
              "png",
              "--output",
              `${name}-${index}.png`,
            ],
            { cwd },
          );
          expect(result.exitCode).toBe(0);
          expect(result.stderr.toString()).not.toContain("glyph-missing");
        }
      }
      for (const name of ["bun", "native"]) {
        expect(
          readFileSync(join(cwd, `${name}-0.png`)).equals(
            readFileSync(join(cwd, `${name}-1.png`)),
          ),
        ).toBe(false);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  120000,
);
