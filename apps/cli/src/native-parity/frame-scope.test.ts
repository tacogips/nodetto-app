import { expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serializeDocument } from "@nodetto/io";
import {
  document,
  element,
} from "../../../../packages/core/src/test-helpers.ts";
import { compare, nativeTest } from "./harness.ts";

nativeTest(
  "frame DDL and lint match native",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-frame-parity-"));
    try {
      const path = join(dir, "schema.jsonl");
      const frame = (
        id: string,
        y: number,
        height: number,
        index: string,
        memberIds?: string[],
      ) =>
        element({
          id,
          type: "frame",
          index,
          semantic: { name: id, ...(memberIds ? { memberIds } : {}) },
          visual: { x: 0, y, width: 400, height },
        });
      const table = (id: string, y: number, index: string) =>
        element({
          id,
          type: "erd.table",
          index,
          semantic: {
            tableName: id,
            columns: [{ id: "id", name: "id", dataType: "integer" }],
          },
          visual: { x: 20, y, width: 100 },
        });
      const page = [{ id: "page-1", name: "Schema", kind: "erd" as const }];
      const write = (entries: ReturnType<typeof element>[]) =>
        writeFileSync(path, serializeDocument(document(entries, page)));
      write([
        frame("zone", 0, 150, "a1"),
        table("widgets", 10, "a2"),
        table("gadgets", 130, "a3"),
        frame("catalog", -10, 300, "a4", ["zone"]),
      ]);
      const args = ["ddl", path, "--page", "Schema", "--dialect", "sqlite"];
      const catalog = compare([...args, "--frame", "catalog", "--strict"]);
      expect(catalog.exitCode).toBe(0);
      expect(catalog.stdout.toString()).toContain("gadgets");
      const zone = compare([...args, "--frame", "zone", "--strict"]);
      expect(zone.exitCode).toBe(3);
      expect(zone.stderr.toString()).toContain("gadgets");
      for (const flags of [[], ["--format", "json"]]) {
        const lint = compare(["lint", path, "--page", "Schema", ...flags]);
        expect(lint.exitCode).toBe(0);
        expect(lint.stdout.toString()).toContain("frame-straddle");
      }
      write([table("widgets", 10, "a1"), frame("late", 0, 150, "a2")]);
      const late = compare([...args, "--frame", "late", "--strict"]);
      expect(late.exitCode).toBe(0);
      expect(late.stdout.toString()).toContain("widgets");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);
