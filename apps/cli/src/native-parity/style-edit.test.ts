import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { binary, cliEntry, nativeTest } from "./harness.ts";

nativeTest(
  "native visual edit matches Bun on separate seed documents",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-style-edit-"));
    try {
      const editor = new Editor();
      const id = editor.createElement("node.generic", {
        id: "widget",
        semantic: { label: "Idle" },
        visual: {
          style: { fill: "#ffffff", dash: "dashed", strokeDashArray: [4, 2] },
        },
      });
      const seed = serializeDocument(editor.getSnapshot());
      for (const patch of [
        { visual: { style: { strokeDashArray: null } } },
        { visual: { style: { strokeDashArray: [] } } },
        { visual: { style: { stroke: "#112233" } } },
        { semantic: { label: null } },
      ]) {
        const paths = [join(dir, "bun.jsonl"), join(dir, "native.jsonl")];
        for (const path of paths) writeFileSync(path, seed);
        const input = new TextEncoder().encode(
          JSON.stringify([{ op: "update", id, ...patch }]),
        );
        const bun = Bun.spawnSync(
          [process.execPath, cliEntry, "edit", paths[0]!, "--ops", "-"],
          { stdin: input },
        );
        const native = Bun.spawnSync(
          [binary!, "edit", paths[1]!, "--ops", "-"],
          { stdin: input },
        );
        expect(native.exitCode).toBe(bun.exitCode);
        expect(native.stderr.toString().replaceAll(paths[1]!, "doc")).toBe(
          bun.stderr.toString().replaceAll(paths[0]!, "doc"),
        );
        expect(readFileSync(paths[1]!, "utf8")).toBe(
          readFileSync(paths[0]!, "utf8"),
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  30000,
);
