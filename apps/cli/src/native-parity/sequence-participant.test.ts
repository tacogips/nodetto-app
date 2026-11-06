import { expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { binary, cliEntry, compare, nativeTest } from "./harness.ts";

nativeTest(
  "participant exports and types match native",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-sequence-parity-"));
    try {
      const doc = join(dir, "doc.jsonl");
      const editor = new Editor();
      for (const [id, kind, order] of [
        ["actor", "actor", "a1"],
        ["service", "service", "a2"],
        ["db", "db", "a3"],
      ] as const)
        editor.createElement("sequence.participant", {
          id,
          semantic: { name: " ", kind, order },
        });
      editor.createElement("sequence.message", {
        id: "message",
        semantic: {
          from: "actor",
          to: "db",
          order: "a4",
          kind: "sync",
          label: "",
        },
      });
      writeFileSync(doc, serializeDocument(editor.getSnapshot()));
      expect(compare(["export", doc, "--format", "svg"]).exitCode).toBe(0);
      for (const flags of [[], ["--format", "json"]])
        expect(
          compare(["types", "sequence.participant", ...flags]).exitCode,
        ).toBe(0);
      const output = join(dir, "out.png");
      const args = ["export", doc, "--format", "png", "--output", output];
      expect(
        Bun.spawnSync([process.execPath, cliEntry, ...args]).exitCode,
      ).toBe(0);
      expect(Bun.spawnSync([binary as string, ...args]).exitCode).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);
