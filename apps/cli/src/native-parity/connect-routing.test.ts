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
      editor.createElement("node.generic", { id: "c" });
      editor.createElement("node.generic", { id: "d" });
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
          routingAvoidObstacles: false,
        },
        {
          op: "connect",
          from: "c",
          to: "d",
          visual: { routing: "straight", routingAvoidObstacles: false },
        },
        { op: "set-page-routing", id: page, routing: null },
        {
          op: "add-page",
          id: "new-page",
          name: "Other",
          connectorRouting: {
            routing: "orthogonal",
            routingAvoidObstacles: true,
          },
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
      expect(nativeDoc.pages.map(({ order: _order, ...page }) => page)).toEqual(
        bunDoc.pages.map(({ order: _order, ...page }) => page),
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
      expect(edges(bunDoc)).toHaveLength(3);
      const edgeC = edges(bunDoc).find(
        (edge) => (edge.semantic as Record<string, unknown>).from === "c",
      );
      expect(edgeC?.semantic).toMatchObject({
        routing: "straight",
        routingAvoidObstacles: false,
      });
      expect(edgeC?.visual).not.toHaveProperty("routing");
      expect(
        edges(bunDoc).find(
          (edge) => (edge.semantic as Record<string, unknown>).from === "a",
        )?.semantic,
      ).toMatchObject({ routing: "orthogonal", routingAvoidObstacles: true });
      expect(
        edges(bunDoc).find(
          (edge) => (edge.semantic as Record<string, unknown>).from === "b",
        )?.semantic,
      ).toMatchObject({ routing: "straight", routingAvoidObstacles: false });
      expect(
        bunDoc.pages.find((item) => item.id === page)?.connectorRouting,
      ).toBeUndefined();
      expect(
        bunDoc.pages.find((item) => item.id === "new-page")?.connectorRouting,
      ).toEqual({ routing: "orthogonal", routingAvoidObstacles: true });
      expect(edges(nativeDoc)).toEqual(edges(bunDoc));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  30000,
);

nativeTest(
  "native page convention and manual page rejection match Bun",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-routing-convention-"));
    try {
      const editor = new Editor();
      for (const id of ["a", "b", "c"])
        editor.createElement("node.generic", { id });
      const peer = editor.buildElement("edge.generic", {
        id: "peer",
        semantic: {
          from: "a",
          to: "b",
          routing: "orthogonal",
          routingAvoidObstacles: true,
        },
      });
      editor.apply([{ type: "createElement", element: peer }]);
      const seed = serializeDocument(editor.getSnapshot());
      const paths = [join(dir, "bun.jsonl"), join(dir, "native.jsonl")];
      for (const path of paths) writeFileSync(path, seed);
      const input = new TextEncoder().encode(
        JSON.stringify([{ op: "connect", from: "b", to: "c" }]),
      );
      const bun = Bun.spawnSync(
        [process.execPath, cliEntry, "edit", paths[0]!, "--ops", "-"],
        { stdin: input },
      );
      const native = Bun.spawnSync([binary!, "edit", paths[1]!, "--ops", "-"], {
        stdin: input,
      });
      expect(native.exitCode).toBe(bun.exitCode);
      expect(bun.exitCode).toBe(0);
      const edge = (path: string) =>
        parseDocument(readFileSync(path, "utf8")).elements.find(
          (item) => (item.semantic as Record<string, unknown>).from === "b",
        );
      expect(edge(paths[1]!)?.semantic).toEqual(edge(paths[0]!)?.semantic);
      expect(edge(paths[0]!)?.semantic).toMatchObject({
        routing: "orthogonal",
        routingAvoidObstacles: true,
      });
      const invalid = new TextEncoder().encode(
        JSON.stringify([
          {
            op: "add-page",
            id: "invalid",
            name: "Invalid",
            connectorRouting: { routing: "manual" },
          },
        ]),
      );
      const bunInvalid = Bun.spawnSync(
        [process.execPath, cliEntry, "edit", paths[0]!, "--ops", "-"],
        { stdin: invalid },
      );
      const nativeInvalid = Bun.spawnSync(
        [binary!, "edit", paths[1]!, "--ops", "-"],
        { stdin: invalid },
      );
      expect(bunInvalid.exitCode).not.toBe(0);
      expect(nativeInvalid.exitCode).toBe(bunInvalid.exitCode);
      expect(nativeInvalid.stderr.toString().replaceAll(paths[1]!, "doc")).toBe(
        bunInvalid.stderr.toString().replaceAll(paths[0]!, "doc"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  30000,
);
