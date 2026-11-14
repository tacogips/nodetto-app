import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Editor,
  connectorWaypointFromPage,
  endpointReaderFor,
  resolveConnector,
} from "@nodetto/core";
import { segmentOverlapsBox } from "../../../../packages/core/src/diagram-lint/metrics.ts";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { validateDocument } from "@nodetto/ir";
import { bpmnLayeredDocument } from "../__fixtures__/bpmn-layered.ts";
import { obstacleRoutingBatch } from "../__fixtures__/obstacle-routing-batch.ts";
import { binary, compare, compareFile, nativeTest } from "./harness.ts";

function framed(kind: "state" | "erd" | "sequence"): string {
  const e = new Editor();
  e.setPageKind(e.currentPageId, kind);
  e.createElement("frame", {
    id: "frame",
    semantic: { name: "Stage" },
    visual: { x: 0, y: 0, width: 600, height: 400 },
  });
  if (kind === "erd") {
    e.createElement("erd.table", {
      id: "table",
      semantic: { tableName: "widgets", columns: [] },
      visual: { x: 50, y: 50, width: 100, height: 100 },
    });
    e.createElement("erd.table", {
      id: "other",
      semantic: { tableName: "orders", columns: [] },
      visual: { x: 250, y: 50, width: 100, height: 100 },
    });
    e.createElement("erd.relation", {
      id: "relation",
      semantic: {
        from: { table: "table" },
        to: { table: "other" },
        cardinality: "1:*",
      },
    });
  } else if (kind === "state")
    e.createElement("state.node", {
      id: "state",
      semantic: { name: "Idle", kind: "state" },
      visual: { x: 50, y: 50, width: 100, height: 60 },
    });
  return serializeDocument(e.getSnapshot());
}

nativeTest(
  "layered and route modes match on supported and excluded pages",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-layout-"));
    try {
      const doc = join(dir, "doc.jsonl");
      const bpmn = bpmnLayeredDocument();
      expect(validateDocument(parseDocument(bpmn))).toEqual([]);
      for (const source of [framed("state"), framed("erd"), bpmn]) {
        expect(
          compareFile(
            ["arrange", doc, "--mode", "layered", "--write"],
            doc,
            source,
          ).exitCode,
        ).toBe(0);
        expect(
          compare(["arrange", doc, "--mode", "layered", "--check"]).exitCode,
        ).toBe(0);
      }
      for (const source of [framed("erd"), bpmn]) {
        expect(
          compareFile(
            ["arrange", doc, "--mode", "route", "--write"],
            doc,
            source,
          ).exitCode,
        ).toBe(0);
        for (const format of ["text", "json"]) {
          const result = compare([
            "lint",
            doc,
            "--metrics",
            "--format",
            format,
          ]);
          expect(result.stdout.toString()).toContain("metrics");
        }
      }
      writeFileSync(doc, framed("sequence"));
      for (const mode of ["layered", "route"])
        expect(compare(["arrange", doc, "--mode", mode]).exitCode).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  120000,
);

nativeTest(
  "native layered obstacle batch meets deadline",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-layout-deadline-"));
    try {
      const doc = join(dir, "doc.jsonl");
      writeFileSync(doc, obstacleRoutingBatch().document);
      const start = performance.now();
      const actual = Bun.spawnSync(
        [binary as string, "arrange", doc, "--mode", "layered"],
        { timeout: 60000 },
      );
      expect(actual.exitCode).toBe(0);
      expect(performance.now() - start).toBeLessThan(10000);
      expect(readFileSync(doc, "utf8")).toBe(obstacleRoutingBatch().document);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  120000,
);

nativeTest(
  "manual route reset preserves nodes and removes waypoints",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-manual-"));
    try {
      const e = new Editor();
      e.setPageKind(e.currentPageId, "state");
      for (const [id, x] of [
        ["a", 0],
        ["block", 200],
        ["b", 400],
      ] as const)
        e.createElement("node.generic", {
          id,
          visual: { x, y: 0, width: 80, height: 80 },
        });
      e.createElement("edge.generic", {
        id: "edge",
        semantic: {
          from: "a",
          to: "b",
          routing: "manual",
          routingWaypoints: [
            connectorWaypointFromPage(
              { x: 180, y: 140 },
              { x: 40, y: 40 },
              { x: 440, y: 40 },
            ),
          ],
        },
      });
      const source = serializeDocument(e.getSnapshot());
      const doc = join(dir, "doc.jsonl");
      expect(
        compareFile(["arrange", doc, "--mode", "route", "--write"], doc, source)
          .exitCode,
      ).toBe(0);
      const points = (text: string) => {
        const editor = new Editor({ document: parseDocument(text) });
        const edge = editor.store.get("edge");
        if (!edge) throw new Error("missing edge");
        const route = resolveConnector(
          edge,
          editor.createShapeContext(),
          endpointReaderFor(edge.type),
        );
        if (!route) throw new Error("missing route");
        return route.points;
      };
      expect(points(readFileSync(doc, "utf8"))).toEqual(points(source));
      expect(
        parseDocument(readFileSync(doc, "utf8")).elements.find(
          (el) => el.id === "edge",
        )?.semantic,
      ).toMatchObject({
        routing: "manual",
        routingWaypoints: [
          connectorWaypointFromPage(
            { x: 180, y: 140 },
            { x: 40, y: 40 },
            { x: 440, y: 40 },
          ),
        ],
      });
      expect(
        compareFile(
          ["arrange", doc, "--mode", "route", "--reset-manual", "--write"],
          doc,
          source,
        ).exitCode,
      ).toBe(0);
      const result = parseDocument(readFileSync(doc, "utf8"));
      const edge = result.elements.find((el) => el.id === "edge")
        ?.semantic as Record<string, unknown>;
      expect(edge.routing).toBe("orthogonal");
      expect(edge.routingWaypoints).toBeUndefined();
      const routed = points(readFileSync(doc, "utf8"));
      for (let i = 1; i < routed.length; i++) {
        const a = routed[i - 1];
        const b = routed[i];
        if (!a || !b) throw new Error("missing route point");
        expect(
          segmentOverlapsBox(a, b, { x: 192, y: -8, width: 96, height: 96 }),
        ).toBe(false);
      }
      for (const id of ["a", "b", "block"])
        expect(result.elements.find((el) => el.id === id)?.visual).toEqual(
          parseDocument(source).elements.find((el) => el.id === id)?.visual,
        );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "BPMN route moves a label away from reserved bounds",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-label-route-"));
    try {
      const editor = new Editor();
      editor.setPageKind(editor.currentPageId, "bpmn");
      for (const [id, x, y] of [
        ["a", 0, 0],
        ["b", 400, 0],
        ["c", 0, 120],
        ["d", 400, 120],
      ] as const)
        editor.createElement("bpmn.task", {
          id,
          visual: { x, y, width: 80, height: 60 },
        });
      editor.createElement("bpmn.sequenceFlow", {
        id: "fixed",
        semantic: { from: "c", to: "d", name: "Reserved" },
        visual: { labelBounds: { x: 220, y: 20, width: 40, height: 20 } },
      });
      editor.createElement("bpmn.sequenceFlow", {
        id: "flow",
        semantic: {
          from: "a",
          to: "b",
          name: "Review",
          fromPort: "right",
          toPort: "left",
          routing: "straight",
        },
      });
      const doc = join(dir, "doc.jsonl");
      const source = serializeDocument(editor.getSnapshot());
      expect(
        compareFile(["arrange", doc, "--mode", "route", "--write"], doc, source)
          .exitCode,
      ).toBe(0);
      const flow = parseDocument(readFileSync(doc, "utf8")).elements.find(
        (e) => e.id === "flow",
      );
      expect(
        (flow?.semantic as Record<string, unknown>).labelPosition,
      ).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);
