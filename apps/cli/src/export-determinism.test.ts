import { expect, test } from "bun:test";
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

test("SVG export is independent of locale, timezone, cwd and formatting", () => {
  const root = mkdtempSync(join(tmpdir(), "nodetto-determinism-"));
  try {
    const editor = new Editor();
    editor.createElement("image.raster", {
      semantic: { src: "artifacts/logo.png", alt: "Logo" },
      visual: { width: 50, height: 50 },
    });
    editor.createElement("node.generic", {
      semantic: { label: "widgets" },
      visual: { x: 100, y: 0 },
    });
    const content = serializeDocument(editor.getSnapshot());
    const lines = content.trimEnd().split("\n");
    const header = lines.shift();
    const noncanonical = [header, ...lines.reverse(), "", ""].join("\n");
    const run = (cwd: string, args: string[], env: Record<string, string>) =>
      Bun.spawnSync(
        [process.execPath, join(import.meta.dir, "main.ts"), ...args],
        { cwd, env: { ...process.env, ...env } },
      );
    const exports: string[] = [];
    for (const [name, tz, lang] of [
      ["one", "UTC", "C"],
      ["two", "Asia/Tokyo", "ja_JP.UTF-8"],
    ] as const) {
      const dir = join(root, name);
      mkdirSync(join(dir, "artifacts"), { recursive: true });
      writeFileSync(
        join(dir, "artifacts/logo.png"),
        Buffer.from("iVBORw0KGgo=", "base64"),
      );
      writeFileSync(join(dir, "doc.jsonl"), noncanonical);
      const env = { TZ: tz, LANG: lang };
      const before = run(dir, ["export", "doc.jsonl", "--format", "svg"], env);
      expect(before.exitCode).toBe(0);
      expect(before.stdout.toString()).toContain("data:image/png;base64,");
      const formatted = run(dir, ["format", "doc.jsonl", "--write"], env);
      expect(formatted.exitCode).toBe(0);
      const formattedContent = readFileSync(join(dir, "doc.jsonl"), "utf8");
      expect(formattedContent).not.toBe(noncanonical);
      expect(formattedContent).toBe(content);
      const after = run(dir, ["export", "doc.jsonl", "--format", "svg"], env);
      expect(after.exitCode).toBe(0);
      expect(after.stdout.toString()).toBe(before.stdout.toString());
      exports.push(before.stdout.toString());
    }
    expect(exports[0]).toBe(exports[1]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
