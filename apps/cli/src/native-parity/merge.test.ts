import { expect } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { binary, cliEntry, compareFile, nativeTest } from "./harness.ts";

nativeTest(
  "native merge matches clean, conflicting and invalid outputs",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-merge-"));
    try {
      const doc = (title: string) =>
        serializeDocument({
          schemaVersion: 1,
          id: "d",
          title,
          pages: [{ id: "p", name: "Page", kind: "freeform" }],
          elements: [],
        });
      const base = join(dir, "base.jsonl");
      const ours = join(dir, "ours.jsonl");
      const theirs = join(dir, "theirs.jsonl");
      const output = join(dir, "output.jsonl");
      writeFileSync(base, doc("Base"));
      writeFileSync(ours, doc("Ours"));
      for (const [source, code] of [
        [doc("Base"), 0],
        [doc("Theirs"), 1],
        [doc("Base").replace('"id":"d"', '"id":"other"'), 2],
      ] as const) {
        writeFileSync(theirs, source);
        expect(
          compareFile(
            ["merge", base, ours, theirs, "--output", output],
            output,
            "sentinel",
          ).exitCode,
        ).toBe(code);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

for (const conflict of [false, true]) {
  nativeTest(
    `native Git merge driver ${conflict ? "conflict" : "disjoint"}`,
    () => {
      const dir = mkdtempSync(join(tmpdir(), "nodetto git native "));
      const env = {
        ...process.env,
        HOME: dir,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      };
      const git = (...args: string[]) =>
        Bun.spawnSync(["git", ...args], { cwd: dir, env });
      const checked = (...args: string[]) => {
        const r = git(...args);
        expect(r.exitCode).toBe(0);
      };
      const doc = (title: string, name = "Page") =>
        serializeDocument({
          schemaVersion: 1,
          id: "d",
          title,
          pages: [{ id: "p", name, kind: "freeform" }],
          elements: [],
        });
      try {
        checked("init", "-b", "main");
        checked("config", "user.name", "Test User");
        checked("config", "user.email", "test@example.invalid");
        checked("config", "commit.gpgsign", "false");
        const quoted = `'${(binary as string).replaceAll("'", "'\\''")}'`;
        checked(
          "config",
          "merge.nodetto.driver",
          `${quoted} merge %O %A %B --output %A`,
        );
        writeFileSync(join(dir, ".gitattributes"), "*.jsonl merge=nodetto\n");
        const path = join(dir, "doc.jsonl");
        writeFileSync(path, doc("Base"));
        checked("add", ".");
        checked("commit", "-m", "base");
        checked("switch", "-c", "theirs");
        writeFileSync(path, conflict ? doc("Theirs") : doc("Base", "Other"));
        checked("add", "doc.jsonl");
        checked("commit", "-m", "theirs");
        checked("switch", "main");
        writeFileSync(path, doc("Ours"));
        checked("add", "doc.jsonl");
        checked("commit", "-m", "ours");
        const result = git("merge", "theirs");
        expect(result.exitCode === 0).toBe(!conflict);
        expect(readFileSync(path, "utf8")).toBe(
          doc("Ours", conflict ? "Page" : "Other"),
        );
        expect(readFileSync(path, "utf8")).not.toContain("<<<<<<<");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    60000,
  );
}

nativeTest(
  "raster SVG export is identical across locale and timezone",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-svg-"));
    try {
      mkdirSync(join(dir, "artifacts"));
      writeFileSync(
        join(dir, "artifacts", "logo.png"),
        Buffer.from("iVBORw0KGgo=", "base64"),
      );
      const editor = new Editor();
      editor.createElement("image.raster", {
        id: "image",
        semantic: { src: "artifacts/logo.png", alt: "Logo" },
        visual: { x: 0, y: 0, width: 50, height: 50 },
      });
      const doc = join(dir, "doc.jsonl");
      const output = join(dir, "out.svg");
      writeFileSync(doc, serializeDocument(editor.getSnapshot()));
      const args = ["export", doc, "--format", "svg", "--output", output];
      const bun = Bun.spawnSync([process.execPath, cliEntry, ...args], {
        env: { ...process.env, TZ: "UTC", LANG: "C" },
      });
      expect(bun.exitCode).toBe(0);
      const expected = readFileSync(output);
      rmSync(output);
      const native = Bun.spawnSync([binary as string, ...args], {
        env: { ...process.env, TZ: "Asia/Tokyo", LANG: "ja_JP.UTF-8" },
      });
      expect(native.exitCode).toBe(0);
      expect(native.stdout.toString()).toBe(bun.stdout.toString());
      expect(native.stderr.toString()).toBe(bun.stderr.toString());
      expect(readFileSync(output)).toEqual(expected);
      expect(expected.toString()).toContain("data:image/png;base64");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);
