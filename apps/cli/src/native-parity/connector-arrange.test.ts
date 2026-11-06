import { expect } from "bun:test";
import { Editor, pageMetrics } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import {
  endpointReaderFor,
  resolveConnector,
} from "../../../../packages/core/src/shapes/connector.ts";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectorArrangeDocument } from "../__fixtures__/connector-arrange.ts";
import { compare, compareFile, nativeTest } from "./harness.ts";

nativeTest(
  "connector fixture matches the native CLI",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-arrange-"));
    try {
      const path = join(dir, "fixture.jsonl");
      const seed = connectorArrangeDocument();
      compareFile(
        ["arrange", path, "--page", "States", "--mode", "layered", "--write"],
        path,
        seed,
      );
      const layered = readFileSync(path, "utf8");
      compareFile(
        ["arrange", path, "--page", "States", "--mode", "route", "--write"],
        path,
        layered,
      );
      compare(["lint", path, "--metrics", "--format", "json"]);
      expect(compare(["lint", path, "--metrics"]).stdout.toString()).toContain(
        "overlapping segment pair(s)",
      );
      const arranged = readFileSync(path, "utf8");
      const editor = new Editor({ document: parseDocument(arranged) });
      const edge = editor
        .getSnapshot()
        .elements.find((item) => item.id === "edge-00");
      const state = editor
        .getSnapshot()
        .elements.find((item) => item.id === "state-00");
      if (!edge || !state) throw new Error("Missing fixture elements");
      const resolved = resolveConnector(
        edge,
        editor.createShapeContext(),
        endpointReaderFor(edge.type),
      );
      if (!resolved) throw new Error("Missing fixture route");
      const document = editor.getSnapshot();
      const forced = serializeDocument({
        ...document,
        elements: document.elements.map((item) =>
          item.id === edge.id
            ? {
                ...item,
                semantic: {
                  ...(item.semantic as Record<string, unknown>),
                  labelOffsetX:
                    (state.visual.x ?? 0) +
                    (state.visual.width ?? 0) / 2 -
                    resolved.labelPoint.x,
                  labelOffsetY:
                    (state.visual.y ?? 0) +
                    (state.visual.height ?? 0) / 2 -
                    resolved.labelPoint.y,
                },
              }
            : item,
        ),
      });
      const forcedEditor = new Editor({ document: parseDocument(forced) });
      expect(
        pageMetrics(forcedEditor.store, edge.page, forcedEditor.registry)
          .labelOverlaps,
      ).toBeGreaterThan(0);
      expect(
        compareFile(["lint", path, "--fix"], path, forced).stdout.toString(),
      ).toContain("moved label");
      const architecture = new Editor({ document: parseDocument(seed) });
      const edges = [
        architecture.buildElement("edge.generic", {
          id: "semantic-edge",
          page: "architecture",
          semantic: {
            from: "box-a",
            to: "box-b",
            routing: "orthogonal",
            routingAvoidObstacles: true,
          },
        }),
        architecture.buildElement("edge.generic", {
          id: "visual-edge",
          page: "architecture",
          semantic: { from: "box-d", to: "box-b" },
          visual: {
            extensions: { routing: "orthogonal", routingAvoidObstacles: true },
          },
        }),
      ];
      architecture.apply(
        edges.map((element) => ({ type: "createElement" as const, element })),
      );
      writeFileSync(path, serializeDocument(architecture.getSnapshot()));
      compare(["export", path, "--page", "Architecture", "--format", "svg"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);
