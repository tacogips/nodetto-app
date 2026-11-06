import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { binary, cliEntry, nativeTest } from "./harness.ts";

nativeTest(
  "native connect routing matches Bun on independent documents",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-connect-routing-"));
    try {
      const editor = new Editor();
      editor.createElement("node.generic", { id: "a" });
      editor.createElement("node.generic", { id: "b" });
      const page = editor.store.listPages()[0]!.id;
      const seed = serializeDocument(editor.getSnapshot());
      const operations = [
        {
          op: "set-page-routing",
          id: page,
          routing: "orthogonal",
          routingAvoidObstacles: true,
        },
        {
          op: "connect",
          from: "a",
          to: "b",
          visual: { style: { stroke: "#112233" } },
        },
        {
          op: "connect",
          from: "b",
          to: "a",
          type: "edge.generic",
          routing: "straight",
        },
      ];
      const paths = [join(dir, "bun.jsonl"), join(dir, "native.jsonl")];
      for (const path of paths) writeFileSync(path, seed);
      const stdin = new TextEncoder().encode(JSON.stringify(operations));
      const bun = Bun.spawnSync(
        [process.execPath, cliEntry, "edit", paths[0]!, "--ops", "-"],
        { stdin },
      );
      const native = Bun.spawnSync([binary!, "edit", paths[1]!, "--ops", "-"], {
        stdin,
      });
      expect(bun.exitCode).toBe(0);
      expect(native.exitCode).toBe(bun.exitCode);
      expect(native.stderr.toString().replaceAll(paths[1]!, "doc")).toBe(
        bun.stderr.toString().replaceAll(paths[0]!, "doc"),
      );
      const bunDoc = parseDocument(readFileSync(paths[0]!, "utf8"));
      const nativeDoc = parseDocument(readFileSync(paths[1]!, "utf8"));
      expect(JSON.stringify(nativeDoc.pages)).toBe(
        JSON.stringify(bunDoc.pages),
      );
      const edges = (doc: typeof bunDoc) =>
        doc.elements
          .filter((e) => e.type === "edge.generic")
          .map((e) => ({ semantic: e.semantic, visual: e.visual }))
          .sort((a, b) =>
            String((a.semantic as Record<string, unknown>).from).localeCompare(
              String((b.semantic as Record<string, unknown>).from),
            ),
          );
      expect(edges(bunDoc)).toHaveLength(2);
      expect(edges(nativeDoc)).toEqual(edges(bunDoc));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  30000,
);
